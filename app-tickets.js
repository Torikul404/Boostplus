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
    tgCard: $('tkTelegramCard'), tgLink: $('tkTelegramLink'), filters: $('tkFilters'),
    subLbl: document.querySelector('#tkSubmit .rf-tk-sublbl') || $('tkSubmit'),
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
    'Orders|Refill': 'Refill is only given for services tagged Refill / Guarantee, and only if the count drops after the order is Completed. Without the tag, refill does not apply.',
    'Orders|Partial / Cancel': 'An order that has already started may not be cancellable. No refund for a wrong link or wrong quantity — write the reason in the message.',
    'Orders|Speed up': 'Orders can start late during busy periods. First check the status below with the Order ID — if it is Processing/In progress, the order is running.',
    'Payments': 'Write the payment method (bKash/Nagad/Rocket/Binance), Transaction ID and amount in the message. Attaching a payment screenshot speeds up verification.',
    'Services': 'Write the code or name of the service you are asking about in the message.'
  };
  function syncHint() {
    const key = el.category.value === 'Orders' ? 'Orders|' + el.sub.value : el.category.value;
    const t = HINTS[key];
    if (!el.hint) return;
    el.hint.hidden = !t;
    if (t) el.hint.textContent = t;
  }

  // ---------- ধাপ ১৭: অগ্রগতি কার্ড + অ্যাকশন গ্রিড (can_* ফ্ল্যাগ দেখে) ----------
  const EMPTY_INFO = '<span class="pb-muted">Select an order to see its status here.</span>';
  const FLAG_KEY = { 'Refill': 'can_refill', 'Partial / Cancel': 'can_cancel', 'Speed up': 'can_speedup' };
  const NO_NOTE = { 'Refill': 'Refill is not available for this order now', 'Partial / Cancel': 'Cancel is not available for this order now', 'Speed up': 'Speed up is not available for this order now' };
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
      else { b.removeAttribute('aria-disabled'); note.textContent = (st === 'ok' && knownOrder && FLAG_KEY[sub]) ? 'Available now' : ''; }
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
      steps = '<ol class="pb-steps" aria-label="Order progress">' + STEPS.map((s, i) =>
        '<li class="' + (i < idx ? 'done' : (i === idx ? 'current' : '')) + '"' + (i === idx ? ' aria-current="step"' : '') + '>' + s + '</li>').join('') + '</ol>';
    }
    let can = '';
    if (order && ('can_refill' in order || 'can_cancel' in order)) {
      const ok = Object.keys(FLAG_KEY).filter((s) => flagState(order, s) === 'ok').map((s) => s === 'Partial / Cancel' ? 'Cancel' : s);
      can = '<span class="pb-can">' + (ok.length ? 'Available now: ' + escapeHtml(ok.join(' · ')) : 'No actions available right now') + '</span>';
    }
    return '<b>' + escapeHtml(d.service_name || 'Order') + '</b>' +
      '<span>Quantity: ' + escapeHtml(d.quantity || '-') + (d.created_at ? ' · ' + escapeHtml(String(d.created_at).slice(0, 10)) : '') + '</span>' +
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
  function sessMobileNow() { try { return (localStorage.getItem('pb_wallet_mobile') || '').replace(/\D/g, ''); } catch (_) { return ''; } }
  async function lookupOrder() {
    const id = el.orderId.value.trim().toUpperCase();
    if (!/^(\d{3,12}|PB-[A-Z0-9-]{8,})$/.test(id)) { showOrderInfo(''); busy(false); clearKnown(); return; }
    const api = sheetApi();
    if (!api) return;
    const seq = ++lookupSeq;
    showOrderInfo('Looking up order…'); busy(true);
    try {
      const res = await fetch(api + '?order_id=' + encodeURIComponent(id) + (sessMobileNow() ? '&mobile=' + encodeURIComponent(sessMobileNow()) : ''));
      const d = await res.json();
      if (seq !== lookupSeq) return; // a newer lookup is running
      if (!d || d.error) { busy(false); clearKnown(); showOrderInfo('This Order ID was not found — please check the ID again.', 'warn', true); return; }
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
        showOrderInfo('<span>Network problem. Could not fetch the order status.</span><button type="button" class="pb-retry" data-pb-retry="lookup">Try again</button>', 'warn', true);
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
      if (pickedFiles.length >= MAX_FILES) { setMsg(`You can attach up to ${MAX_FILES} images.`); break; }
      if (f.type && !f.type.startsWith('image/')) { setMsg('Only images (screenshots) can be attached.'); continue; }
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

    if (!isValidMobile(mobile)) return setMsg('Enter a valid mobile number (11 digits, starting with 01).');
    if (category === 'Orders' && !orderId) return setMsg('Enter the Order ID for an Orders ticket.');
    if (message.length < 5) return setMsg('Write a message.');
    if (Date.now() - lastSubmitAt < COOLDOWN_MS) return setMsg('Please wait a moment and try again.');

    const api = sheetApi();
    if (!api) return setMsg('Server is not configured.');

    // ধাপ ১১: লগইন করা ব্যবহারকারী নিজের অর্ডারে Refill/Cancel/Speed up চাইলে, টিকিটের সাথে একই সার্ভার-পথে (অর্ডার কার্ডের মতো) অনুরোধও যাবে
    const ACT_SUB = { 'Refill': 'refill', 'Partial / Cancel': 'cancel', 'Speed up': 'speedup' };
    const rawLs = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
    const sessTok = rawLs('pb_wallet_token'), sessMobile = rawLs('pb_wallet_mobile').replace(/\D/g, '');
    const actSub = ACT_SUB[subcategory];
    const directAct = category === 'Orders' && actSub && sessTok && knownOrder &&
      (String(knownOrder.order_id).toUpperCase() === orderId || String(knownOrder.display_id || '').toUpperCase() === orderId) && flagState(knownOrder, subcategory) === 'ok';
    if (directAct && actSub === 'cancel' && knownOrder.can_cancel === 'instant' &&
        !window.confirm('Order ' + orderId + ' will be cancelled now and the money refunded to your wallet. Continue?')) return;

    el.submit.disabled = true;
    el.subLbl.textContent = 'Submitting…';
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
        setMsg((data && data.message) || 'The ticket was not submitted. Please try again.');
        return;
      }

      const doneTicketId = pendingTicketId;
      let actNote = '';
      if (directAct) {
        try {
          const ar = await fetch(api, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'wallet_auth', sub: actSub, token: sessTok, order_id: String(knownOrder.order_id) })
          });
          const ad = await ar.json();
          if (ad && ad.error === 'auth') actNote = 'Session expired, so the direct request was not sent; an admin will review the ticket.';
          else if (ad && ad.ok) actNote = (ad.message || 'Request sent.');
          else actNote = ((ad && ad.message) || 'Direct request failed') + ' — an admin will review the ticket.';
          if (ad && ad.ok && ad.ticket_id && ad.ticket_id !== doneTicketId) {
            // সার্ভার অন্য একটি Open টিকিটে রিপ্লাই বসাবে; সেটিও এই ডিভাইসে দেখাই
            setLocal([{ ticket_id: ad.ticket_id, created_at: new Date().toLocaleString('en-GB'), category, subcategory, order_id: orderId, message: message.slice(0, 300), status: 'Open' }]
              .concat(getLocal().filter((t) => t.ticket_id !== ad.ticket_id)));
          }
        } catch (_) { actNote = 'Network problem: the direct request was not sent; an admin will review the ticket.'; }
      }

      // success — remember it on this device
      const entry = { ticket_id: pendingTicketId, created_at: new Date().toLocaleString('en-GB'), category, subcategory, order_id: orderId, message: message.slice(0, 300), status: 'Open' };
      setLocal([entry].concat(getLocal().filter((t) => t.ticket_id !== entry.ticket_id)));
      lsSet(LS_MOBILE, mobile);
      lastSubmitAt = Date.now();
      setMsg(`Ticket submitted. Ticket ID: ${doneTicketId}` + (actNote ? ' — ' + actNote : ''), 'ok');
      pendingTicketId = null;
      el.orderId.value = ''; showOrderInfo(''); el.message.value = ''; pickedFiles = []; renderFiles();
      loadTickets();
    } catch (err) {
      // pendingTicketId is kept, so pressing Submit again can't create a duplicate
      setMsg('Network problem — please submit again.');
    } finally {
      el.submit.disabled = false;
      el.subLbl.textContent = 'Submit ticket';
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

  // R15: what the customer sees = real status + whether we replied (nothing invented)
  //  closed   = Resolved / Closed       answered = has a support reply (not closed)
  //  progress = In Progress, no reply   pending  = Open, no reply
  function tState(t) {
    const s = String(t.status || 'Open').toLowerCase();
    if (s === 'resolved' || s === 'closed') return 'closed';
    if (t.admin_reply) return 'answered';
    return s === 'in progress' ? 'progress' : 'pending';
  }
  const ST_LABEL = { pending: 'Pending', progress: 'In progress', answered: 'Answered' };
  const CAT_ICON = {
    Orders: '<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    Payments: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><path d="M16 14.5h2"/>',
    Services: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
    Other: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'
  };
  let filter = 'all';
  function inFilter(t, f, seen) {
    const st = tState(t);
    if (f === 'pending') return st === 'pending' || st === 'progress';
    if (f === 'answered') return st === 'answered';
    if (f === 'closed') return st === 'closed';
    if (f === 'unread') return !!t.admin_reply && seen[t.ticket_id] !== t.replied_at;
    return true;
  }
  function paintFilters(all, seen) {
    if (!el.filters) return;
    el.filters.querySelectorAll('.rf-tk-f').forEach((b) => {
      const f = b.dataset.f;
      b.setAttribute('aria-pressed', String(f === filter));
      const c = b.querySelector('.rf-tk-f__c');
      if (c) c.textContent = all.filter((t) => inFilter(t, f, seen)).length;
    });
  }

  function renderList() {
    const q = (el.search.value || '').trim().toLowerCase();
    const seen = lsGet(LS_SEEN, {});
    const all = merged();
    paintFilters(all, seen);
    let list = all.filter((t) => inFilter(t, filter, seen));
    if (q) {
      list = list.filter((t) => [t.ticket_id, t.order_id, t.category, t.subcategory, t.message, t.status, t.admin_reply]
        .join(' ').toLowerCase().includes(q));
    }
    if (!list.length) {
      el.list.innerHTML = `<div class="pb-empty rf-tk-empty">${(q || filter !== 'all') ? 'No tickets found.' : 'No tickets yet.'}</div>`;
      return;
    }
    el.list.innerHTML = list.map((t) => {
      const unread = t.admin_reply && seen[t.ticket_id] !== t.replied_at;
      const st = tState(t);
      const stLabel = st === 'closed' ? (t.status || 'Closed') : ST_LABEL[st];
      const title = escapeHtml(t.category || 'Ticket') + (t.subcategory ? ' · ' + escapeHtml(t.subcategory) : '');
      const ico = CAT_ICON[t.category] || CAT_ICON.Other;
      return `
      <details class="pb-ticket rf-tk-card${unread ? ' is-unread' : ''}" data-id="${escapeHtml(t.ticket_id)}" data-replied="${escapeHtml(t.replied_at || '')}">
        <summary>
          <span class="rf-iconsq rf-tk-card__ic"><svg class="rf-tk-ic" viewBox="0 0 24 24" aria-hidden="true">${ico}</svg></span>
          <span class="rf-tk-card__main">
            <span class="rf-tk-card__title">${title}</span>
            <span class="rf-tk-card__chips">
              <span class="rf-chip rf-chip--id">#${escapeHtml(t.ticket_id)}</span>
              ${t.order_id ? `<span class="rf-chip">Order ${escapeHtml(t.order_id)}</span>` : ''}
              <span class="rf-chip rf-chip--date">${escapeHtml(t.created_at || '')}</span>
            </span>
          </span>
          <span class="rf-tk-card__badges">
            ${unread ? '<span class="pb-new rf-tk-new">NEW</span>' : ''}
            <span class="rf-tk-st rf-tk-st--${st}">${escapeHtml(stLabel)}</span>
          </span>
        </summary>
        <div class="pb-t-body">
          <div class="pb-t-label">Your message</div>
          <p>${escapeHtml(t.message)}</p>
          ${t.admin_reply
            ? `<div class="pb-t-label">Support reply <span class="pb-t-time">${escapeHtml(t.replied_at || '')}</span></div><p class="pb-reply">${escapeHtml(t.admin_reply)}</p>`
            : '<div class="pb-t-wait">Waiting for a reply…</div>'}
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
    d.classList.remove('is-unread');
    updateBadge();
    paintFilters(merged(), lsGet(LS_SEEN, {}));   // counts only: re-rendering would close the ticket the customer just opened
  }, true);

  if (el.filters) el.filters.addEventListener('click', (e) => {
    const b = e.target.closest('.rf-tk-f'); if (!b) return;
    filter = b.dataset.f || 'all'; renderList();
  });
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
