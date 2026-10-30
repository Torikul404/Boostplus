/* ==========================================================
   app-tickets.js — Layer 3: the Tickets page.
   - Category / Subcategory form ("Orders" shows the Subcategory)
   - Optional screenshots (compressed with compressProofImage)
   - Submit → Google Apps Script "ticket_create"
   - "My tickets" list + search, with admin replies
   The site has no login, so a visitor's tickets are remembered on this
   device (random ticket IDs in localStorage) and looked up by those IDs.
   Depends on: app-core.js (sheetApi, escapeHtml, isValidMobile,
   PB_SUPPORT) and app-proof-upload.js (compressProofImage).
   ========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const view = $('tickets-view');
  if (!view) return;

  const LS_TICKETS = 'pb_tickets_v1';      // [{ticket_id, created_at, category, subcategory, order_id, message, status}]
  const LS_SEEN = 'pb_tickets_seen_v1';    // { ticket_id: replied_at already read }
  const LS_MOBILE = 'pb_ticket_mobile_v1';
  const MAX_FILES = 3;
  const COOLDOWN_MS = 20000;

  const el = {
    category: $('tkCategory'), subWrap: $('tkSubWrap'), sub: $('tkSub'),
    mobile: $('tkMobile'), orderId: $('tkOrderId'), orderHint: $('tkOrderHint'),
    message: $('tkMessage'), files: $('tkFiles'), attachBtn: $('tkAttachBtn'),
    fileList: $('tkFileList'), msg: $('tkMsg'), submit: $('tkSubmit'),
    search: $('tkSearch'), searchBtn: $('tkSearchBtn'), list: $('tkList'),
    tgCard: $('tkTelegramCard'), tgLink: $('tkTelegramLink'),
    badge: $('pbTicketBadge'), hint: $('tkHint'), orderInfo: $('tkOrderInfo')
  };

  let pickedFiles = [];          // File objects
  let pendingTicketId = null;    // kept across retries so a resend never duplicates
  let lastSubmitAt = 0;
  let serverData = {};           // ticket_id -> latest server copy

  // ---------- storage helpers (all guarded: private mode can throw) ----------
  function lsGet(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }
  const getLocal = () => lsGet(LS_TICKETS, []);
  const setLocal = (list) => lsSet(LS_TICKETS, list.slice(0, 50));

  function newTicketId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'TK-';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // ---------- smart hints + order status lookup ----------
  const HINTS = {
    'Orders|Refill': 'রিফিল শুধু Refill / Guarantee ট্যাগযুক্ত সার্ভিসে দেওয়া হয়, এবং অর্ডার Completed হওয়ার পর ড্রপ হলে। ট্যাগ না থাকলে রিফিল প্রযোজ্য নয়।',
    'Orders|Partial / Cancel': 'শুরু হয়ে যাওয়া অর্ডার বাতিল নাও হতে পারে। ভুল লিংক বা ভুল কোয়ান্টিটির জন্য রিফান্ড প্রযোজ্য নয় — কারণ মেসেজে লিখে দিন।',
    'Orders|Speed up': 'ব্যস্ত সময়ে অর্ডার শুরু হতে দেরি হয়। আগে নিচে Order ID দিয়ে স্ট্যাটাস দেখে নিন — Processing/In progress হলে অর্ডার চলছে।',
    'Payments': 'মেসেজে পেমেন্ট মাধ্যম (bKash/Nagad/Rocket/Binance), Transaction ID ও টাকার পরিমাণ লিখুন। পেমেন্টের স্ক্রিনশট attach করলে দ্রুত যাচাই হয়।',
    'Services': 'কোন সার্ভিস নিয়ে প্রশ্ন সেটার কোড বা নাম মেসেজে লিখুন।'
  };
  function syncHint() {
    const key = el.category.value === 'Orders' ? 'Orders|' + el.sub.value : el.category.value;
    const t = HINTS[key];
    if (!el.hint) return;
    el.hint.hidden = !t;
    if (t) el.hint.textContent = '💡 ' + t;
  }

  // ---------- ধাপ ১৭: অগ্রগতি কার্ড + অ্যাকশন গ্রিড (can_* ফ্ল্যাগ দেখে) ----------
  const EMPTY_INFO = '<span class="pb-muted">অর্ডার বেছে নিলে এখানে অবস্থা দেখাবে।</span>';
  const FLAG_KEY = { 'Refill': 'can_refill', 'Partial / Cancel': 'can_cancel', 'Speed up': 'can_speedup' };
  const NO_NOTE = { 'Refill': 'এই অর্ডারে এখন Refill নেই', 'Partial / Cancel': 'এই অর্ডারে এখন Cancel নেই', 'Speed up': 'এই অর্ডারে এখন Speed up নেই' };
  let knownOrder = null;          // লগইন করা ব্যবহারকারীর অর্ডার তালিকা থেকে (ফ্ল্যাগসহ)

  /** 'ok' | 'no' | 'unknown' — ফ্ল্যাগ না থাকলে (লগইন নেই / অর্ডার নিজের নয় / ব্যাকএন্ডে ফ্ল্যাগ এখনো নেই) 'unknown' */
  function flagState(order, sub) {
    const k = FLAG_KEY[sub];
    if (!k) return 'ok';
    if (!order || (!('can_refill' in order) && !('can_cancel' in order))) return 'unknown';
    if (!(k in order)) return 'unknown';
    const v = order[k];
    return (v === true || (typeof v === 'string' && v !== '')) ? 'ok' : 'no';
  }
  function setSelect(sel, v) { if (sel.value === v) return; sel.value = v; sel.dispatchEvent(new Event('change')); }
  function paintChips() {
    document.querySelectorAll('#tkTypeChips .pb-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === el.category.value)));
  }
  function paintActs() {
    document.querySelectorAll('#tkActions .pb-act').forEach((b) => {
      const sub = b.dataset.sub, st = flagState(knownOrder, sub), note = b.querySelector('.pb-act-n');
      b.setAttribute('aria-pressed', String(sub === el.sub.value));
      if (st === 'no') { b.setAttribute('aria-disabled', 'true'); note.textContent = NO_NOTE[sub]; }
      else { b.removeAttribute('aria-disabled'); note.textContent = (st === 'ok' && knownOrder && FLAG_KEY[sub]) ? 'এখন করা যাবে' : ''; }
    });
    if (flagState(knownOrder, el.sub.value) === 'no') setSelect(el.sub, 'Other');
  }
  document.getElementById('tkTypeChips').addEventListener('click', (e) => {
    const b = e.target.closest('.pb-chip'); if (b) setSelect(el.category, b.dataset.cat);
  });
  document.getElementById('tkActions').addEventListener('click', (e) => {
    const b = e.target.closest('.pb-act');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    setSelect(el.sub, b.dataset.sub); paintActs();
  });
  el.category.addEventListener('change', paintChips);
  el.sub.addEventListener('change', paintActs);

  const STEPS = ['Pending', 'Processing', 'Completed'];
  function stepIndex(st) {
    const s = String(st || '').toLowerCase();
    if (s === 'pending') return 0;
    if (s === 'in progress' || s === 'processing') return 1;
    if (s === 'completed') return 2;
    return -1;   // Partial / Canceled / Refunded — ধাপ-রেখা নেই, শুধু ব্যাজ
  }
  function stClass(st) {
    const s = String(st || '').toLowerCase();
    return s === 'completed' ? 'st-completed' : (s === 'partial' ? 'st-partial' : (/cancel|refund/.test(s) ? 'st-canceled' : (s === 'pending' ? 'st-pending' : 'st-processing')));
  }
  function progressHtml(d, order) {
    const idx = stepIndex(d.status);
    let steps = '';
    if (idx >= 0) {
      steps = '<ol class="pb-steps" aria-label="অর্ডারের অগ্রগতি">' + STEPS.map((s, i) =>
        '<li class="' + (i < idx ? 'done' : (i === idx ? 'current' : '')) + '"' + (i === idx ? ' aria-current="step"' : '') + '>' + s + '</li>').join('') + '</ol>';
    }
    let can = '';
    if (order && ('can_refill' in order || 'can_cancel' in order)) {
      const ok = Object.keys(FLAG_KEY).filter((s) => flagState(order, s) === 'ok').map((s) => s === 'Partial / Cancel' ? 'Cancel' : s);
      can = '<span class="pb-can">' + (ok.length ? 'এখন সম্ভব: ' + escapeHtml(ok.join(' · ')) : 'এই মুহূর্তে কোনো অ্যাকশন নেই') + '</span>';
    }
    return '<b>' + escapeHtml(d.service_name || 'Order') + '</b>' +
      '<span>পরিমাণ: ' + escapeHtml(d.quantity || '-') + (d.created_at ? ' · ' + escapeHtml(String(d.created_at).slice(0, 10)) : '') + '</span>' +
      '<span class="pb-st-pill ' + stClass(d.status) + '">' + escapeHtml(d.status || '-') + '</span>' + steps + can;
  }

  let lookupSeq = 0;
  let lookupTimer = null;
  const prog = $('tkProgress');
  function busy(on) { if (window.PB_A11Y) PB_A11Y.busy(prog, on); }
  function showOrderInfo(html, cls, isAlert) {
    el.orderInfo.className = 'pb-order-info' + (cls ? ' ' + cls : '');
    if (isAlert) el.orderInfo.setAttribute('role', 'alert'); else el.orderInfo.removeAttribute('role');
    el.orderInfo.innerHTML = html || EMPTY_INFO;
  }
  function clearKnown() { knownOrder = null; paintActs(); }
  async function lookupOrder() {
    const id = el.orderId.value.trim().toUpperCase();
    if (!/^(\d{5,8}|PB-[A-Z0-9-]{8,})$/.test(id)) { showOrderInfo(''); busy(false); clearKnown(); return; }
    const api = sheetApi();
    if (!api) return;
    const seq = ++lookupSeq;
    showOrderInfo('অর্ডার খোঁজা হচ্ছে…'); busy(true);
    try {
      const res = await fetch(api + '?order_id=' + encodeURIComponent(id));
      const d = await res.json();
      if (seq !== lookupSeq) return; // a newer lookup is running
      if (!d || d.error) { busy(false); clearKnown(); showOrderInfo('⚠️ এই Order ID পাওয়া যায়নি — আইডিটি আবার দেখে নিন।', 'warn', true); return; }
      let o = null;
      try { if (window.PB_ORDERS) { await PB_ORDERS.ensure(); o = PB_ORDERS.get(id); } } catch (_) {}
      if (seq !== lookupSeq) return;
      knownOrder = o; paintActs();
      busy(false);
      // Only show harmless fields (never the link, TrxID or phone number)
      showOrderInfo(progressHtml(d, o), 'ok');
    } catch (_) {
      if (seq === lookupSeq) {
        busy(false); clearKnown();
        showOrderInfo('<span>নেটওয়ার্ক সমস্যা। অর্ডারের অবস্থা আনা যায়নি।</span><button type="button" class="pb-retry" data-pb-retry="lookup">আবার চেষ্টা করুন</button>', 'warn', true);
      }
    }
  }
  el.orderId.addEventListener('input', () => { clearTimeout(lookupTimer); lookupTimer = setTimeout(lookupOrder, 500); });
  el.orderId.addEventListener('blur', lookupOrder);

  // ---------- form behaviour ----------
  function syncCategory() {
    const isOrders = el.category.value === 'Orders';
    el.subWrap.hidden = !isOrders;                       // Subcategory only for Orders
    el.orderHint.textContent = isOrders ? '(required)' : '(optional)';
    syncHint();
  }
  el.category.addEventListener('change', syncCategory);
  el.sub.addEventListener('change', syncHint);
  syncCategory();
  paintChips(); paintActs(); showOrderInfo('');

  el.mobile.value = lsGet(LS_MOBILE, '');
  el.mobile.addEventListener('input', () => { el.mobile.value = el.mobile.value.replace(/\D/g, '').slice(0, 11); });

  if (window.PB_SUPPORT && PB_SUPPORT.telegram && el.tgCard && el.tgLink) {
    el.tgLink.href = PB_SUPPORT.telegram;
    el.tgCard.hidden = false;
  }

  function setMsg(text, kind) {
    el.msg.textContent = text || '';
    el.msg.className = 'pb-msg' + (text ? ' show ' + (kind || 'err') : '');
  }

  // ---------- attachments ----------
  function renderFiles() {
    el.fileList.innerHTML = pickedFiles.map((f, i) =>
      `<span class="pb-file-chip">${escapeHtml(f.name || 'image')}<button type="button" data-rm="${i}" aria-label="Remove file">&times;</button></span>`
    ).join('');
  }
  el.attachBtn.addEventListener('click', () => el.files.click());
  el.files.addEventListener('change', () => {
    const incoming = Array.from(el.files.files || []);
    el.files.value = '';
    for (const f of incoming) {
      if (pickedFiles.length >= MAX_FILES) { setMsg(`সর্বোচ্চ ${MAX_FILES}টি ছবি দেওয়া যাবে।`); break; }
      if (f.type && !f.type.startsWith('image/')) { setMsg('শুধু ছবি (screenshot) attach করা যাবে।'); continue; }
      pickedFiles.push(f);
    }
    renderFiles();
  });
  el.fileList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    pickedFiles.splice(Number(b.dataset.rm), 1);
    renderFiles();
  });

  // ---------- submit ----------
  async function submitTicket() {
    setMsg('');
    const category = el.category.value;
    const subcategory = category === 'Orders' ? el.sub.value : '';
    const mobile = el.mobile.value.replace(/\D/g, '');
    const orderId = el.orderId.value.trim().toUpperCase();
    const message = el.message.value.trim();

    if (!isValidMobile(mobile)) return setMsg('সঠিক মোবাইল নম্বর দিন (১১ ডিজিট, 01 দিয়ে শুরু)।');
    if (category === 'Orders' && !orderId) return setMsg('Orders টিকিটের জন্য Order ID দিন।');
    if (message.length < 5) return setMsg('Message লিখুন।');
    if (Date.now() - lastSubmitAt < COOLDOWN_MS) return setMsg('একটু অপেক্ষা করে আবার চেষ্টা করুন।');

    const api = sheetApi();
    if (!api) return setMsg('Server সেট করা নেই।');

    // ধাপ ১১: লগইন করা ব্যবহারকারী নিজের অর্ডারে Refill/Cancel/Speed up চাইলে, টিকিটের সাথে একই সার্ভার-পথে (অর্ডার কার্ডের মতো) অনুরোধও যাবে
    const ACT_SUB = { 'Refill': 'refill', 'Partial / Cancel': 'cancel', 'Speed up': 'speedup' };
    const rawLs = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
    const sessTok = rawLs('pb_wallet_token'), sessMobile = rawLs('pb_wallet_mobile').replace(/\D/g, '');
    const actSub = ACT_SUB[subcategory];
    const directAct = category === 'Orders' && actSub && sessTok && sessMobile === mobile && knownOrder &&
      String(knownOrder.order_id).toUpperCase() === orderId && flagState(knownOrder, subcategory) === 'ok';
    if (directAct && actSub === 'cancel' && knownOrder.can_cancel === 'instant' &&
        !window.confirm('অর্ডার ' + orderId + ' এখনই বাতিল হবে এবং টাকা ওয়ালেটে ফেরত যাবে। চালিয়ে যাবেন?')) return;

    el.submit.disabled = true;
    el.submit.textContent = 'Submitting…';
    try {
      const files = [];
      for (const f of pickedFiles) {
        try {
          const c = await compressProofImage(f);
          files.push({ base64: c.base64, mime: c.mime });
        } catch (_) { /* skip an unreadable image rather than blocking the ticket */ }
      }
      if (!pendingTicketId) pendingTicketId = newTicketId();
      const payload = { action: 'ticket_create', ticket_id: pendingTicketId, category, subcategory, order_id: orderId, mobile, message, files };

      const res = await fetch(api, {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data || data.ok !== true) {
        setMsg((data && data.message) || 'টিকিট জমা হয়নি। আবার চেষ্টা করুন।');
        return;
      }

      const doneTicketId = pendingTicketId;
      let actNote = '';
      if (directAct) {
        try {
          const ar = await fetch(api, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'wallet_auth', sub: actSub, token: sessTok, order_id: orderId })
          });
          const ad = await ar.json();
          if (ad && ad.error === 'auth') actNote = 'লগইন মেয়াদ শেষ, তাই সরাসরি অনুরোধ যায়নি; অ্যাডমিন টিকিট দেখবেন।';
          else if (ad && ad.ok) actNote = (ad.message || 'অনুরোধ পাঠানো হয়েছে।');
          else actNote = ((ad && ad.message) || 'সরাসরি অনুরোধ হয়নি') + ' — অ্যাডমিন টিকিট দেখবেন।';
          if (ad && ad.ok && ad.ticket_id && ad.ticket_id !== doneTicketId) {
            // সার্ভার অন্য একটি Open টিকিটে রিপ্লাই বসাবে; সেটিও এই ডিভাইসে দেখাই
            setLocal([{ ticket_id: ad.ticket_id, created_at: new Date().toLocaleString('en-GB'), category, subcategory, order_id: orderId, message: message.slice(0, 300), status: 'Open' }]
              .concat(getLocal().filter((t) => t.ticket_id !== ad.ticket_id)));
          }
        } catch (_) { actNote = 'নেটওয়ার্ক সমস্যায় সরাসরি অনুরোধ যায়নি; অ্যাডমিন টিকিট দেখবেন।'; }
      }

      // success — remember it on this device
      const entry = { ticket_id: pendingTicketId, created_at: new Date().toLocaleString('en-GB'), category, subcategory, order_id: orderId, message: message.slice(0, 300), status: 'Open' };
      setLocal([entry].concat(getLocal().filter((t) => t.ticket_id !== entry.ticket_id)));
      lsSet(LS_MOBILE, mobile);
      lastSubmitAt = Date.now();
      setMsg(`✅ টিকিট জমা হয়েছে। Ticket ID: ${doneTicketId}` + (actNote ? ' — ' + actNote : ''), 'ok');
      pendingTicketId = null;
      el.orderId.value = ''; showOrderInfo(''); el.message.value = ''; pickedFiles = []; renderFiles();
      loadTickets();
    } catch (err) {
      // pendingTicketId is kept, so pressing Submit again can't create a duplicate
      setMsg('নেটওয়ার্ক সমস্যা — আবার Submit করুন।');
    } finally {
      el.submit.disabled = false;
      el.submit.textContent = 'Submit Ticket';
    }
  }
  el.submit.addEventListener('click', submitTicket);

  // ---------- list + search ----------
  function merged() {
    return getLocal().map((t) => Object.assign({}, t, serverData[t.ticket_id] || {}));
  }
  function unreadCount(list) {
    const seen = lsGet(LS_SEEN, {});
    return list.filter((t) => t.admin_reply && seen[t.ticket_id] !== t.replied_at).length;
  }
  function updateBadge(list) {
    if (!el.badge) return;
    const n = unreadCount(list || merged());
    el.badge.textContent = n;
    el.badge.hidden = n === 0;
  }

  function statusClass(s) { return 'st-' + String(s || 'Open').toLowerCase().replace(/[^a-z]+/g, '-'); }

  function renderList() {
    const q = (el.search.value || '').trim().toLowerCase();
    const seen = lsGet(LS_SEEN, {});
    let list = merged();
    if (q) {
      list = list.filter((t) => [t.ticket_id, t.order_id, t.category, t.subcategory, t.message, t.status, t.admin_reply]
        .join(' ').toLowerCase().includes(q));
    }
    if (!list.length) {
      el.list.innerHTML = `<div class="pb-empty">${q ? 'কোনো টিকিট পাওয়া যায়নি।' : 'এখনো কোনো টিকিট নেই।'}</div>`;
      return;
    }
    el.list.innerHTML = list.map((t) => {
      const unread = t.admin_reply && seen[t.ticket_id] !== t.replied_at;
      const cat = escapeHtml(t.category) + (t.subcategory ? ' · ' + escapeHtml(t.subcategory) : '');
      return `
      <details class="pb-ticket" data-id="${escapeHtml(t.ticket_id)}" data-replied="${escapeHtml(t.replied_at || '')}">
        <summary>
          <span class="pb-t-top"><b>${escapeHtml(t.ticket_id)}</b>
            <span class="pb-status ${statusClass(t.status)}">${escapeHtml(t.status || 'Open')}</span>
            ${unread ? '<span class="pb-new">নতুন রিপ্লাই</span>' : ''}
          </span>
          <span class="pb-t-meta">${cat}${t.order_id ? ' · ' + escapeHtml(t.order_id) : ''} · ${escapeHtml(t.created_at || '')}</span>
        </summary>
        <div class="pb-t-body">
          <div class="pb-t-label">আপনার মেসেজ</div>
          <p>${escapeHtml(t.message)}</p>
          ${t.admin_reply
            ? `<div class="pb-t-label">Support-এর রিপ্লাই <span class="pb-t-time">${escapeHtml(t.replied_at || '')}</span></div><p class="pb-reply">${escapeHtml(t.admin_reply)}</p>`
            : '<div class="pb-t-wait">রিপ্লাইয়ের অপেক্ষায়…</div>'}
        </div>
      </details>`;
    }).join('');
  }

  // mark a reply as read when the ticket is opened
  el.list.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.classList || !d.classList.contains('pb-ticket') || !d.open) return;
    const id = d.dataset.id, replied = d.dataset.replied;
    if (!replied) return;
    const seen = lsGet(LS_SEEN, {});
    if (seen[id] === replied) return;
    seen[id] = replied;
    lsSet(LS_SEEN, seen);
    const pill = d.querySelector('.pb-new');
    if (pill) pill.remove();
    updateBadge();
  }, true);

  el.searchBtn.addEventListener('click', renderList);
  el.search.addEventListener('input', renderList);
  el.search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); renderList(); } });

  async function loadTickets() {
    renderList();                       // instant, from this device
    const api = sheetApi();
    const ids = getLocal().map((t) => t.ticket_id);
    if (!api || !ids.length) return;
    try {
      const res = await fetch(api + '?action=ticket_list&ids=' + encodeURIComponent(ids.join(',')));
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.tickets)) {
        serverData = {};
        data.tickets.forEach((t) => { serverData[t.ticket_id] = t; });
        renderList();
        updateBadge();
      }
    } catch (_) { /* offline — the local copy is already on screen */ }
  }

  function onOpen() { loadTickets(); }
  document.addEventListener('pb:tickets-open', onOpen);
  if (view.style.display === 'block') onOpen();   // opened by a /#tickets deep link before this file loaded

  // Sidebar badge: quietly check for replies shortly after page load
  if (getLocal().length) {
    setTimeout(async () => {
      const api = sheetApi();
      if (!api) return;
      try {
        const ids = getLocal().map((t) => t.ticket_id).join(',');
        const res = await fetch(api + '?action=ticket_list&ids=' + encodeURIComponent(ids));
        const data = await res.json();
        if (data && data.ok) {
          data.tickets.forEach((t) => { serverData[t.ticket_id] = t; });
          updateBadge();
        }
      } catch (_) {}
    }, 2500);
  }
})();
