/* ==========================================================
   app-orders.js — Order History page + sidebar account card.
   Uses the wallet session (localStorage pb_wallet_token / pb_wallet_mobile).
   Backend: POST { action:"wallet_auth", sub:"orders", token }
   ========================================================== */
(function () {
  const LS_TOKEN = 'pb_wallet_token';
  const LS_MOBILE = 'pb_wallet_mobile';
  const $ = (id) => document.getElementById(id);

  let all = [];          // every order fetched
  let filter = 'All';
  let loading = false;
  let loadedAt = 0;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const token = () => { try { return localStorage.getItem(LS_TOKEN) || ''; } catch (e) { return ''; } };
  const savedName = () => { try { return localStorage.getItem('pb_wallet_name') || ''; } catch (e) { return ''; } };
  const mobile = () => { try { return localStorage.getItem(LS_MOBILE) || ''; } catch (e) { return ''; } };
  const apiUrl = () => (typeof sheetApi === 'function' ? sheetApi() : '') || window.BOOSTPLUS_SHEET_API || '';

  function openWallet() {
    const b = $('navWalletBtn');
    if (b) b.click();
    const s = $('pbSidebarClose');
    if (s && $('pbSidebar') && $('pbSidebar').classList.contains('open')) s.click();
  }

  // ---------- sidebar account card (ছবি + নাম + ব্যালেন্স) ----------
  const photoKey = () => 'pb_acct_photo_' + mobile();
  const getPhoto = () => { try { return localStorage.getItem(photoKey()) || ''; } catch (e) { return ''; } };
  function paintAvatar(name) {
    const img = $('pbAcctImg'), ini = $('pbAcctInit');
    if (!img || !ini) return;
    const p = token() ? getPhoto() : '';
    if (p) { img.src = p; img.hidden = false; ini.hidden = true; }
    else {
      img.hidden = true; img.removeAttribute('src'); ini.hidden = false;
      const s = String(name || '').trim();
      ini.textContent = s && /[^\d+\s]/.test(s) ? Array.from(s)[0].toUpperCase() : '👤';
    }
  }
  function paintAccount() {
    const num = $('pbAcctNum'), bal = $('pbAcctBal'), login = $('pbAcctLogin');
    if (!num || !bal) return;
    const m = mobile(), mob = $('pbAcctMob'), add = $('pbAcctAdd'), bb = bal.parentNode;
    if (token() && m) {
      const nm = savedName() || m;
      num.textContent = nm;
      num.title = m;
      if (mob) { mob.textContent = savedName() ? m : ''; mob.hidden = !savedName(); }
      const dn = $('userDashName'); if (dn && savedName() && dn.textContent.trim() === '—') dn.textContent = savedName();
      const nb = $('navWalletBal');
      const t = nb && nb.textContent ? nb.textContent.trim() : '';
      bal.textContent = t || '৳—';
      if (bb) bb.hidden = false;
      if (login) login.hidden = true;
      paintAvatar(nm);
    } else {
      num.textContent = 'Not logged in';
      if (mob) { mob.textContent = ''; mob.hidden = true; }
      bal.textContent = '—';
      if (bb) bb.hidden = true;
      if (login) login.hidden = false;
      paintAvatar('');
    }
  }
  // ছবি বদলানো: ১৬০px এ ছোট করে শুধু এই ডিভাইসে (localStorage) রাখা হয়
  function pickPhoto(file) {
    if (!file || !/^image\//.test(file.type) || !token()) return;
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
        const side = Math.min(im.width, im.height), sx = (im.width - side) / 2, sy = (im.height - side) / 2;
        c.getContext('2d').drawImage(im, sx, sy, side, side, 0, 0, S, S);
        try { localStorage.setItem(photoKey(), c.toDataURL('image/jpeg', 0.82)); } catch (e) {}
        paintAccount();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  document.addEventListener('pb:sidebar-open', paintAccount);
  const nb = $('navWalletBal');
  if (nb && window.MutationObserver) new MutationObserver(paintAccount).observe(nb, { childList: true, characterData: true, subtree: true, attributes: true });
  if ($('pbAcctLogin')) $('pbAcctLogin').addEventListener('click', openWallet);
  if ($('pbAcctAdd')) $('pbAcctAdd').addEventListener('click', openWallet);
  if ($('pbAcctAvatar') && $('pbAcctFile')) {
    $('pbAcctAvatar').addEventListener('click', () => { if (token()) $('pbAcctFile').click(); else openWallet(); });
    $('pbAcctFile').addEventListener('change', (e) => { pickPhoto(e.target.files && e.target.files[0]); e.target.value = ''; });
  }
  paintAccount();

  // ---------- order history ----------
  function statusClass(st) { return 's-' + String(st || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function statusLabel(st) { return /^(rejected|canceled|cancelled)$/i.test(String(st || '')) ? 'Canceled' : (st || ''); }
  // ধাপ ১৮: ফিল্টারের নাম ইংরেজিতে (All, Pending, In progress, Processing, Completed, Partial, Canceled); Rejected/Cancelled = Canceled
  function stKey(st) {
    const k = String(st || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    if (k === 'rejected' || k === 'canceled' || k === 'cancelled') return 'Canceled';
    if (k === 'in progress') return 'In progress';
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : '';
  }
  function fmtDate(v) {
    const s = String(v || '');
    // 2026-10-07T01:00:54+06:00  ->  2026-10-07 01:00:54
    return s.replace('T', ' ').replace(/(\.\d+)?([+-]\d{2}:\d{2}|Z)$/, '').slice(0, 19);
  }
  // ---------- Refill / Cancel buttons (step 5) ----------
  // The server decides what is allowed (can_refill / can_cancel); this only draws buttons and sends the click.
  function waitLabel(ms) {
    const mins = Math.max(1, Math.ceil((Number(ms) - Date.now()) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
  }
  function actionsHtml(o) {
    const id = esc(o.order_id);
    const out = [];
    if (o.can_refill) {
      const wait = Number(o.refill_next_ms) > Date.now();
      out.push('<button type="button" class="pb-oh-act pb-oh-refill" data-act="refill" data-id="' + id + '"' + (wait ? ' disabled title="পরের রিফিল: ' + esc(waitLabel(o.refill_next_ms)) + ' পর"' : '') + '>🔄 Refill' + (wait ? ' (' + esc(waitLabel(o.refill_next_ms)) + ')' : '') + '</button>');
    }
    if (o.can_speedup) {
      const waitS = Number(o.speedup_next_ms) > Date.now();
      out.push('<button type="button" class="pb-oh-act pb-oh-speed" data-act="speedup" data-id="' + id + '"' + (waitS ? ' disabled title="পরের Speed up: ' + esc(waitLabel(o.speedup_next_ms)) + ' পর"' : '') + '>🚀 Speed up' + (waitS ? ' · ' + esc(waitLabel(o.speedup_next_ms)) : '') + '</button>');
    }
    if (o.can_cancel) {
      if (o.cancel_requested) out.push('<span class="pb-oh-note">বাতিলের অনুরোধ পাঠানো হয়েছে</span>');
      else out.push('<button type="button" class="pb-oh-act pb-oh-cancel" data-act="cancel" data-kind="' + esc(o.can_cancel) + '" data-id="' + id + '">' + (o.can_cancel === 'instant' ? '✕ Cancel' : '✕ Cancel request') + '</button>');
    }
    // সাহায্য বাটন: শুধু যখন সার্ভার অন্তত একটি can_* ফ্ল্যাগ দিয়েছে (ফ্ল্যাগ ছাড়া কোনো বাটনই নয়)
    if (hasFlags(o)) out.push('<button type="button" class="pb-oh-act pb-oh-help" data-act="help" data-id="' + id + '">সাহায্য</button>');
    return out.length ? out.join(' ') : '<span class="pb-oh-note">—</span>';
  }
  function hasFlags(o) { return !!(o && (o.can_refill || o.can_cancel || o.can_speedup)); }
  function showMsg(text, ok) {
    const el = $('ohMsg');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
    el.className = 'pb-oh-msg ' + (ok ? 'ok' : 'err');
  }
  // ধাপ ৯: অ্যাকশনে সার্ভার যে টিকেট খুলল/ব্যবহার করল, সহায়তা পাতায় দেখানোর জন্য তার আইডি এই ডিভাইসে রাখি
  function rememberTicket(d, act, id) {
    try {
      if (!d || !d.ticket_id) return;
      const KEY = 'pb_tickets_v1';
      const list = JSON.parse(localStorage.getItem(KEY) || '[]') || [];
      if (list.some((t) => t.ticket_id === d.ticket_id)) return;
      const sub = act === 'refill' ? 'Refill' : (act === 'cancel' ? 'Partial / Cancel' : 'Speed up');
      list.unshift({ ticket_id: d.ticket_id, created_at: new Date().toLocaleString('en-GB'), category: 'Orders',
        subcategory: sub, order_id: String(id).toUpperCase(), message: 'অর্ডার পাতা থেকে অনুরোধ', status: 'Open' });
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
  }
  // সাহায্য: সহায়তা পাতা খুলে Order ID বসিয়ে দেয় (সহায়তা পাতা নিজেই অর্ডারের ফ্ল্যাগ দেখে বাটন দেখায়)
  function openHelp(id) {
    const go = document.querySelector('[data-go="tickets"]');
    if (go) go.click(); else { location.hash = 'tickets'; }
    setTimeout(function () {
      const inp = $('tkOrderId');
      if (inp) { inp.value = String(id); inp.dispatchEvent(new Event('input', { bubbles: true })); try { inp.focus({ preventScroll: false }); } catch (e) {} }
    }, 60);
  }
  async function doAction(btn) {
    const act = btn.dataset.act, id = btn.dataset.id;
    if (!id || btn.disabled) return;
    if (act === 'help') { openHelp(id); return; }
    const sure = act === 'refill'
      ? 'অর্ডার ' + id + '-এ রিফিল পাঠাতে চান?'
      : act === 'speedup' ? 'অর্ডার ' + id + '-এ Speed up অনুরোধ পাঠাবেন? একবার পাঠালে ৩ ঘণ্টা পরে আবার পাঠানো যাবে।'
      : (btn.dataset.kind === 'instant'
          ? 'অর্ডার ' + id + ' বাতিল করবেন? টাকা ওয়ালেটে ফেরত যাবে।'
          : 'অর্ডার ' + id + ' বাতিলের অনুরোধ পাঠাবেন? শুরু হয়ে যাওয়া অর্ডার বাতিল নাও হতে পারে।');
    if (!window.confirm(sure)) return;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = '…';
    try {
      const res = await fetch(apiUrl(), {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'wallet_auth', sub: act, token: token(), order_id: id })
      });
      const d = await res.json();
      if (d && d.error === 'auth') { showMsg('লগইন মেয়াদ শেষ। আবার লগইন করুন।', false); return; }
      if (d && d.ok) rememberTicket(d, act, id);
      let dm = d && d.message;
      if (!dm && d && d.error === 'too_soon' && d.next_ms) dm = 'আগের অনুরোধের পর অপেক্ষা করুন: ' + waitLabel(d.next_ms) + ' পর আবার চেষ্টা করা যাবে।';
      if (!dm && d && d.ok && act === 'speedup') dm = 'Speed up অনুরোধ পাঠানো হয়েছে।';
      showMsg(dm || (d && d.ok ? 'সম্পন্ন হয়েছে।' : 'ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'), !!(d && d.ok));
    } catch (e) {
      showMsg('নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।', false);
    } finally {
      btn.textContent = label;
      btn.disabled = false;
      load(true); // refresh flags/cooldowns from the server
    }
  }

  function shortLink(l) { return String(l || '').replace(/^https?:\/\//i, ''); }

  // ---------- list state ----------
  let sortBy = 'new';
  let shown = 20;
  const PAGE = 20;
  const liveMap = {};      // order_id -> { start_count, remains, live, ts }
  let liveBusy = false;

  const ACTIVE = ['pending', 'processing'];
  const lc = (v) => String(v || '').toLowerCase();
  function toDate(v) { const d = new Date(String(v || '')); return isNaN(d.getTime()) ? null : d; }
  function dayKey(d) { return d ? (d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()) : 'x'; }
  function dayLabel(d) {
    if (!d) return 'Earlier';
    const t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
    if (dayKey(d) === dayKey(t)) return 'Today';
    if (dayKey(d) === dayKey(y)) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function timeLabel(d) { return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''; }
  function money(v) { const n = Number(v); return isNaN(n) ? String(v == null ? '' : v) : (n % 1 ? n.toFixed(2) : String(n)); }
  function progressPct(st, o) {
    const k = lc(st);
    const lv = o && liveMap[String(o.order_id)];
    const q = o ? Number(o.quantity) : 0;
    if (lv && lv.live && k === 'processing' && q > 0 && lv.remains != null) return Math.max(8, Math.min(97, Math.round((q - lv.remains) / q * 100)));
    return k === 'pending' ? 15 : k === 'processing' ? 55 : (k === 'completed' || k === 'partial' || k === 'rejected') ? 100 : 0;
  }

  function counts() {
    const c = { All: all.length, Pending: 0, 'In progress': 0, Processing: 0, Completed: 0, Partial: 0, Canceled: 0 };
    let spent = 0, active = 0;
    all.forEach((o) => {
      const k = stKey(o.status);
      if (c[k] !== undefined) c[k]++;
      if (k !== 'Canceled') spent += Number(o.amount) || 0;
      if (ACTIVE.indexOf(lc(k)) !== -1 || k === 'In progress') active++;
    });
    document.querySelectorAll('.pb-oh-c').forEach((el) => { el.textContent = c[el.dataset.c] || 0; });
    if ($('ohStTotal')) $('ohStTotal').textContent = all.length;
    if ($('ohStSpent')) $('ohStSpent').textContent = '৳' + money(Math.round(spent * 100) / 100);
    if ($('ohStActive')) $('ohStActive').textContent = active;
    if ($('ohStDone')) $('ohStDone').textContent = c.Completed;
  }

  function filtered() {
    const q = ($('ohSearch').value || '').trim().toLowerCase().replace(/^#/, '');
    const rows = all.filter((o) => {
      if (filter !== 'All' && stKey(o.status) !== filter) return false;
      if (!q) return true;
      return (String(o.order_id) + ' ' + o.link + ' ' + o.service_name + ' ' + o.service_code + ' ' + o.status + ' ' + o.created_at).toLowerCase().indexOf(q) !== -1;
    });
    const ts = (o) => { const d = toDate(o.created_at); return d ? d.getTime() : 0; };
    if (sortBy === 'old') rows.sort((x, y) => ts(x) - ts(y));
    else if (sortBy === 'amt') rows.sort((x, y) => (Number(y.amount) || 0) - (Number(x.amount) || 0));
    else rows.sort((x, y) => ts(y) - ts(x));
    return rows;
  }

  function num(v) { return Number(v).toLocaleString('en-US'); }
  function liveRowHtml(o) {
    const k = lc(o.status);
    if (k !== 'processing' && k !== 'partial' && k !== 'completed') return '';
    const lv = liveMap[String(o.order_id)];
    const sc = !lv ? '…' : (lv.live && lv.start_count != null ? num(lv.start_count) : '—');
    const rm = !lv ? '…' : (lv.live && lv.remains != null ? num(lv.remains) : '—');
    return '<div class="pb-oh-live" data-live="' + esc(o.order_id) + '">' +
      '<div><span class="k">Start count</span><b>' + sc + '</b></div>' +
      '<div><span class="k">Remaining</span><b>' + rm + '</b></div>' +
      '<span class="pb-oh-livedot" title="Live from provider"></span>' +
    '</div>';
  }

  // Ask the server for provider-side Start count / Remaining of the orders on screen (max 8, active first).
  async function loadLive() {
    if (liveBusy || !token()) return;
    const rank = { processing: 0, partial: 1, completed: 2 };
    const ids = filtered().slice(0, shown)
      .filter((o) => rank[lc(o.status)] !== undefined)
      .filter((o) => { const lv = liveMap[String(o.order_id)]; return !lv || Date.now() - lv.ts > 25000; })
      .sort((a, b) => rank[lc(a.status)] - rank[lc(b.status)])
      .slice(0, 8)
      .map((o) => String(o.order_id));
    if (!ids.length) return;
    liveBusy = true;
    try {
      const res = await fetch(apiUrl(), {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'wallet_auth', sub: 'live', token: token(), order_ids: ids })
      });
      const d = await res.json();
      if (d && d.ok && d.items) {
        ids.forEach((id) => { const it = d.items[id]; liveMap[id] = Object.assign({ live: false }, it || {}, { ts: Date.now() }); });
        render(true);
      }
    } catch (e) {
      ids.forEach((id) => { if (!liveMap[id]) liveMap[id] = { live: false, ts: Date.now() }; });
      render(true);
    } finally { liveBusy = false; }
  }

  function cardHtml(o) {
    const d = toDate(o.created_at);
    const id = esc(o.order_id);
    const safe = typeof safeHttpUrl === 'function' ? safeHttpUrl(o.link) : '';
    const linkHtml = o.link
      ? (safe ? '<a href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(shortLink(o.link)) + '</a>' : '<span>' + esc(shortLink(o.link)) + '</span>')
      : '';
    const hasAct = hasFlags(o);
    const k = lc(o.status);
    return '<article class="pb-oh-card s-' + esc(k.replace(/[^a-z0-9]+/g, '-')) + '" data-id="' + id + '">' +
      '<div class="pb-oh-ch">' +
        '<button type="button" class="pb-oh-idbtn" data-copy="' + id + '" title="Copy order ID" aria-label="Copy order ID ' + id + '">#' + id + ' <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button>' +
        '<span class="pb-oh-st ' + statusClass(o.status) + '">' + esc(statusLabel(o.status)) + '</span>' +
      '</div>' +
      '<h4 class="pb-oh-svcname">' + esc(o.service_name || o.service_code || 'Order') + '</h4>' +
      (linkHtml ? '<div class="pb-oh-link">' + linkHtml + '</div>' : '') +
      '<div class="pb-oh-grid">' +
        '<div><span class="k">Quantity</span><b>' + esc(o.quantity) + '</b></div>' +
        '<div><span class="k">Charge</span><b>৳' + esc(money(o.amount)) + '</b></div>' +
        '<div><span class="k">Time</span><b>' + esc(d ? timeLabel(d) : fmtDate(o.created_at)) + '</b></div>' +
      '</div>' +
      liveRowHtml(o) +
      '<div class="pb-oh-prog" aria-hidden="true"><i style="width:' + progressPct(o.status, o) + '%"></i></div>' +
      (hasAct ? '<div class="pb-oh-actions">' + actionsHtml(o) + '</div>' : '') +
    '</article>';
  }

  // ডেস্কটপ (≥১০২৪ px): টেবিল — ID | সার্ভিস | লিংক | পরিমাণ | স্ট্যাটাস | বাটন; মোবাইল: কার্ড
  const mqTable = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : { matches: false };
  function rowHtml(o) {
    const id = esc(o.order_id), k = lc(o.status);
    const safe = typeof safeHttpUrl === 'function' ? safeHttpUrl(o.link) : '';
    const linkHtml = o.link ? (safe ? '<a href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(shortLink(o.link)) + '</a>' : '<span>' + esc(shortLink(o.link)) + '</span>') : '—';
    const d = toDate(o.created_at);
    return '<tr class="pb-oh-row s-' + esc(k.replace(/[^a-z0-9]+/g, '-')) + '" data-id="' + id + '">' +
      '<td class="oh-id"><button type="button" class="pb-oh-idbtn" data-copy="' + id + '" title="Copy order ID" aria-label="Copy order ID ' + id + '">#' + id + '</button></td>' +
      '<td class="oh-svc"><span class="oh-svcname" title="' + esc(o.service_name || '') + '">' + esc(o.service_name || o.service_code || 'Order') + '</span><span class="oh-sub">' + esc(d ? dayLabel(d) + ' · ' + timeLabel(d) : fmtDate(o.created_at)) + ' · ৳' + esc(money(o.amount)) + '</span>' + liveRowHtml(o) + '</td>' +
      '<td class="oh-link">' + linkHtml + '</td>' +
      '<td class="oh-qty">' + esc(o.quantity) + '</td>' +
      '<td class="oh-stat"><span class="pb-oh-st ' + statusClass(o.status) + '">' + esc(statusLabel(o.status)) + '</span></td>' +
      '<td class="oh-act"><div class="pb-oh-actions">' + actionsHtml(o) + '</div></td>' +
    '</tr>';
  }
  function render(fromLive) {
    const rows = filtered();
    const part = rows.slice(0, shown);
    let html = '', lastKey = null;
    if (mqTable.matches) {
      html = '<div class="pb-oh-tablewrap"><table class="pb-oh-table"><thead><tr><th scope="col">ID</th><th scope="col">সার্ভিস</th><th scope="col">লিংক</th><th scope="col">পরিমাণ</th><th scope="col">স্ট্যাটাস</th><th scope="col"><span class="sr-only">অ্যাকশন</span></th></tr></thead><tbody>' + part.map(rowHtml).join('') + '</tbody></table></div>';
    } else part.forEach((o) => {
      if (sortBy !== 'amt') {
        const d = toDate(o.created_at), key = dayKey(d);
        if (key !== lastKey) { html += '<div class="pb-oh-day">' + esc(dayLabel(d)) + '</div>'; lastKey = key; }
      }
      html += cardHtml(o);
    });
    $('ohList').innerHTML = html;
    const em = $('ohEmpty');
    em.hidden = rows.length > 0;
    if (!rows.length) em.textContent = loading ? 'লোড হচ্ছে…' : (all.length ? 'এই ফিল্টারে কোনো অর্ডার নেই' : 'এখনো কোনো অর্ডার করা হয়নি');
    const more = $('ohMore');
    more.hidden = rows.length <= shown;
    if (rows.length > shown) more.textContent = 'আরও দেখুন (' + (rows.length - shown) + ' টি বাকি)';
    if (!fromLive) loadLive();
  }

  function copyText(text, btn) {
    const done = () => {
      if (!btn) return;
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1200);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); return; }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    } catch (e) {}
    done();
  }

  function exportCsv() {
    const rows = filtered();
    if (!rows.length) { showMsg('এক্সপোর্ট করার মতো অর্ডার নেই', false); return; }
    const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['Order ID', 'Date', 'Service', 'Code', 'Link', 'Quantity', 'Charge', 'Status'];
    const lines = [head.map(cell).join(',')].concat(rows.map((o) => [
      o.order_id, fmtDate(o.created_at), o.service_name, o.service_code, o.link, o.quantity, o.amount, statusLabel(o.status)
    ].map(cell).join(',')));
    try {
      const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'orders-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { showMsg('CSV ডাউনলোড করা যায়নি', false); }
  }

  /** ধাপ ১৬: ত্রুটিতে role=alert + "আবার চেষ্টা" বাটন; ঠিক হলে সাধারণ অবস্থায় ফেরে */
function ohFail(msg) {
  const em = $('ohEmpty');
  em.hidden = false; em.setAttribute('role', 'alert');
  em.innerHTML = '<p></p><button type="button" class="pb-retry" data-pb-retry="orders">আবার চেষ্টা করুন</button>';
  em.firstChild.textContent = msg;
}
function ohOk() { const em = $('ohEmpty'); if (em) em.removeAttribute('role'); }

async function load(force) {
    const guest = $('ohGuest'), main = $('ohMain');
    if (!guest || !main) return;
    if (!token()) { guest.hidden = false; main.hidden = true; return; }
    guest.hidden = true; main.hidden = false;
    if (loading) return;
    if (!force && all.length && Date.now() - loadedAt < 20000) { render(); return; }
    loading = true;
    let failed = false;
    if (window.PB_A11Y) PB_A11Y.busy($('ohList'), true);
    ohOk();
    if (!all.length) render();
    try {
      const url = apiUrl();
      if (!url) throw new Error('API নেই');
      const res = await fetch(url, {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'wallet_auth', sub: 'orders', token: token() })
      });
      const d = await res.json();
      if (d && d.ok) {
        all = (d.orders || []).filter(function (o) { return String(o.service_code || '').toUpperCase() !== 'TOPUP'; });
        loadedAt = Date.now();
        shown = Math.max(shown, PAGE);
        if ($('ohUpdated')) $('ohUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      } else if (d && d.error === 'auth') {
        all = [];
        guest.hidden = false; main.hidden = true;
      } else {
        failed = true;
        ohFail((d && (d.message || d.error)) || 'লোড ব্যর্থ। আবার চেষ্টা করুন।');
      }
    } catch (e) {
      failed = true;
      ohFail('নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।');
    } finally {
      loading = false;
      if (window.PB_A11Y) PB_A11Y.busy($('ohList'), false);
      counts();
      if (!failed || all.length) render();
    }
  }

  function wire() {
    if (!$('ohFilters')) return;
    try { (mqTable.addEventListener ? mqTable.addEventListener('change', () => render(true)) : (mqTable.addListener && mqTable.addListener(() => render(true)))); } catch (e) {}
    $('ohFilters').addEventListener('click', (e) => {
      const b = e.target.closest('.pb-oh-f');
      if (!b) return;
      filter = b.dataset.st;
      shown = PAGE;
      document.querySelectorAll('.pb-oh-f').forEach((x) => x.classList.toggle('active', x === b));
      render();
    });
    const reset = () => { shown = PAGE; render(); };
    $('ohSearch').addEventListener('input', reset);
    $('ohSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') reset(); });
    $('ohSearchBtn').addEventListener('click', reset);
    $('ohSort').addEventListener('change', () => { sortBy = $('ohSort').value; shown = PAGE; render(); });
    $('ohRefresh').addEventListener('click', () => load(true));
    $('ohExport').addEventListener('click', exportCsv);
    $('ohMore').addEventListener('click', () => { shown += PAGE; render(); });
    $('ohList').addEventListener('click', (e) => {
      const c = e.target.closest('button[data-copy]');
      if (c) { copyText(c.dataset.copy, c); return; }
      const b = e.target.closest('button[data-act]');
      if (b) doAction(b);
    });
    $('ohLoginBtn').addEventListener('click', openWallet);
    document.addEventListener('pb:orders-open', () => load(false));
    // quietly refresh while the page is open and something is still in progress
    setInterval(() => {
      const v = $('orders-view');
      if (!v || v.style.display === 'none' || document.visibilityState !== 'visible' || loading) return;
      if (all.some((o) => ACTIVE.indexOf(lc(o.status)) !== -1)) load(true);
    }, 30000);
  }
  wire();
  // deep link /#orders (the sidebar router ran before this file loaded)
  if ((location.hash || '') === '#orders') load(false);

  /** ধাপ ১৭: সহায়তা পাতা এখান থেকে অর্ডারের can_* ফ্ল্যাগ পড়ে (শুধু পড়া; লগইন না থাকলে খালি) */
  window.PB_ORDERS = {
    ensure: function () { return token() ? load(false) : Promise.resolve(); },
    get: function (id) {
      const k = String(id || '').trim().toUpperCase();
      return all.find(function (o) { return String(o.order_id).toUpperCase() === k; }) || null;
    }
  };
})();
