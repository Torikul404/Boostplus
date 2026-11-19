/* ==========================================================
   app-refunds.js — R17 "Refunds" page (needs login, no backend change).
   Data: POST { action:"wallet_auth", sub:"history", ledger_limit:100 } -> `ledger` rows.
   A refund = ledger row with type "refund" and a positive amount
   (id, amount, ref = internal order id, reason, created_at).
   Canceled / Partial: taken from the order's own status (PB_ORDERS, same feed as the
   Orders page); if the order is not in that feed, from the reason text the server wrote.
   Real data only: nothing is invented, "View order" is drawn only when the order is known.
   ========================================================== */
(function () {
  const LS_TOKEN = 'pb_wallet_token';
  const LS_BANNER = 'pb_rfd_banner_off';
  const PAGE = 12;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const token = () => { try { return localStorage.getItem(LS_TOKEN) || ''; } catch (e) { return ''; } };
  const apiUrl = () => (typeof sheetApi === 'function' ? sheetApi() : '') || window.BOOSTPLUS_SHEET_API || '';
  const lc = (v) => String(v == null ? '' : v).trim().toLowerCase();

  let rows = [];            // normalised refunds, newest first
  let filter = 'all';
  let shown = PAGE;
  let loading = false, loadedAt = 0, failed = false, full = false;

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function when(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const d = new Date(t + 6 * 3600000);   // Asia/Dhaka, like the other pages
    const p2 = (n) => (n < 10 ? '0' : '') + n;
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes());
  }
  function money(v) { const n = Number(v); return isNaN(n) ? String(v == null ? '' : v) : String(parseFloat(n.toFixed(4))); }
  function moneyBig(v) { const n = Math.round((Number(v) || 0) * 100) / 100; return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }

  const IC = {
    coins: '<svg class="rf-rf-ic" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    copy: '<svg class="rf-rf-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    eye: '<svg class="rf-rf-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    x: '<svg class="rf-rf-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    half: '<svg class="rf-rf-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>',
    cal: '<svg class="rf-rf-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>'
  };

  function orderOf(ref) { try { return (window.PB_ORDERS && PB_ORDERS.get) ? PB_ORDERS.get(ref) : null; } catch (e) { return null; } }

  // Partial or Canceled for one ledger row
  function kindOf(r, o) {
    const st = lc(o && o.status);
    if (st === 'partial') return 'partial';
    if (st === 'rejected' || st === 'canceled' || st === 'cancelled') return 'canceled';
    const m = /remains\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i.exec(r.reason || '');
    if (m && Number(m[1]) > 0 && Number(m[1]) < Number(m[2])) return 'partial';
    if (/remaining refund/i.test(r.reason || '')) return 'partial';
    return 'canceled';
  }

  // everything a card and the search need, resolved at paint time (the orders feed can arrive after the ledger)
  function prep(r) {
    const o = orderOf(r.ref);
    const sv = r.sv || {};
    const id = (o && (o.display_id || o.order_id)) || sv.display_id || r.ref || '';
    const svc = (o && o.service_name) ? String(o.service_name) : (sv.service_name ? String(sv.service_name) : '');
    return { r, o, id: String(id), svc, kind: kindOf(r, o || sv), hay: (String(id) + ' ' + r.ref + ' ' + svc).toLowerCase() };
  }

  function card(p) {
    const r = p.r, partial = p.kind === 'partial';
    return '<article class="rf-rf-card" data-ref="' + esc(r.ref) + '">' +
      '<div class="rf-rf-top">' +
        (p.id ? '<span class="rf-chip rf-chip--id">#' + esc(p.id) + '</span>' +
          '<button type="button" class="rf-button rf-button--outline rf-button--sm rf-rf-copy" data-copy="' + esc(p.id) + '">' + IC.copy + '<span>Copy</span></button>' : '<span class="rf-chip rf-chip--id">Refund</span>') +
      '</div>' +
      (p.svc ? '<h3 class="rf-rf-name">' + esc(p.svc) + '</h3>' : '') +
      '<div class="rf-rf-chips">' +
        '<span class="rf-rf-amt" title="Returned to your wallet">' + IC.coins + '<b>+৳' + esc(money(r.amount)) + '</b></span>' +
        (when(r.at) ? '<span class="rf-chip rf-chip--date rf-rf-date">' + IC.cal + esc(when(r.at)) + '</span>' : '') +
      '</div>' +
      '<div class="rf-rf-acts">' +
        '<span class="rf-rf-st rf-rf-st--' + p.kind + '">' + (partial ? IC.half : IC.x) + '<span>' + (partial ? 'Partial' : 'Canceled') + '</span></span>' +
        (p.o ? '<button type="button" class="rf-button rf-button--primary rf-rf-view" data-view="' + esc(r.ref) + '">' + IC.eye + '<span>View order</span></button>' : '') +
      '</div>' +
    '</article>';
  }

  function msg(t) { $('rfdList').innerHTML = '<div class="rf-rf-msg" role="status">' + esc(t) + '</div>'; }
  function setCount(txt) { const c = $('rfdCount'); if (!c) return; c.textContent = txt || ''; c.hidden = !txt; }

  function paint() {
    const guest = $('rfdGuest'), main = $('rfdMain');
    if (!guest || !main) return;
    if (!token()) { guest.hidden = false; main.hidden = true; $('rfdTiles').hidden = true; return; }
    guest.hidden = true; main.hidden = false;

    const all = rows.map(prep);
    const nC = all.filter((p) => p.kind === 'canceled').length, nP = all.length - nC;
    const set = (k, n) => { const el = document.querySelector('#rfdPills [data-c="' + k + '"]'); if (el) el.textContent = String(n); };
    set('all', all.length); set('canceled', nC); set('partial', nP);

    const tiles = $('rfdTiles');
    if (all.length) {
      $('rfdTotal').textContent = '৳' + moneyBig(rows.reduce((a, r) => a + (Number(r.amount) || 0), 0));
      $('rfdN').textContent = String(all.length);
      tiles.hidden = false;
    } else tiles.hidden = true;

    const more = $('rfdMore');
    if (loading && !rows.length) { setCount(''); more.hidden = true; msg('Loading…'); return; }
    if (failed && !rows.length) { setCount(''); more.hidden = true; msg('Could not load your refunds. Please try again in a moment.'); return; }
    if (!all.length) { setCount(''); more.hidden = true; msg('No refunds yet. When an order is canceled or only partly delivered, the money returned to your wallet will show up here.'); return; }

    const q = (($('rfdSearch') && $('rfdSearch').value) || '').trim().toLowerCase().replace(/^#/, '');
    let list = filter === 'all' ? all : all.filter((p) => p.kind === filter);
    if (q) list = list.filter((p) => p.hay.indexOf(q) >= 0);
    setCount((q || filter !== 'all') ? list.length + ' of ' + all.length + ' refunds' : all.length + (all.length === 1 ? ' refund' : ' refunds'));
    if (!list.length) { more.hidden = true; msg('No refunds match. Try another filter or a shorter search.'); return; }
    $('rfdList').innerHTML = list.slice(0, shown).map(card).join('');
    more.hidden = list.length <= shown;
  }

  async function load(force) {
    const main = $('rfdMain'); if (!main) return;
    if (!token()) { rows = []; paint(); return; }
    if (loading) return;
    if (!force && loadedAt && Date.now() - loadedAt < 20000) { paint(); return; }
    loading = true; failed = false;
    if (!rows.length) paint();
    try {
      const url = apiUrl();
      if (!url) throw new Error('no api');
      const post = async (body) => {
        const res = await fetch(url, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        return res.json();
      };
      // 1) dedicated list (all refunds, with order info). 2) fallback for an older Code.gs: latest 100 ledger rows.
      let d = await post({ action: 'wallet_auth', sub: 'refunds', token: token(), limit: 300 });
      if (d && d.ok && Array.isArray(d.refunds)) {
        full = true;
        rows = d.refunds.filter((r) => Number(r.amount) > 0).map((r) => ({
          id: r.id, amount: Number(r.amount), ref: String(r.ref || ''), reason: String(r.reason || ''), at: r.created_at,
          sv: { display_id: r.display_id, service_name: r.service_name, status: r.status }
        }));
        loadedAt = Date.now();
      } else if (d && d.error === 'auth') {
        rows = [];
      } else {
        full = false;
        d = await post({ action: 'wallet_auth', sub: 'history', token: token(), limit: 1, ledger_limit: 100 });
        if (d && d.ok) {
          rows = (d.ledger || [])
            .filter((r) => lc(r.type) === 'refund' && Number(r.amount) > 0)
            .map((r) => ({ id: r.id, amount: Number(r.amount), ref: String(r.ref || ''), reason: String(r.reason || ''), at: r.created_at }));
          loadedAt = Date.now();
        } else if (d && d.error === 'auth') { rows = []; } else { failed = true; }
      }
      const bt = $('rfdBannerTxt');
      if (bt) bt.textContent = full
        ? 'Refunds are added to your wallet balance right away. This list shows all the refunds on your account.'
        : 'Refunds are added to your wallet balance right away. This list shows refunds from your latest 100 wallet entries.';
    } catch (e) { failed = true; }
    // order names / status / "View order" come from the same feed as the Orders page.
    // PB_ORDERS.ensure() returns at once when the Orders page is already loading it,
    // so look again a few times until every refund that can be matched has been matched.
    const matched = () => rows.filter((r) => orderOf(r.ref)).length;
    try { if (window.PB_ORDERS && PB_ORDERS.ensure) await PB_ORDERS.ensure(); } catch (e) {}
    loading = false;
    paint();
    let seen = matched();
    for (let i = 0; i < 6 && rows.length && seen < rows.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const n = matched();
      if (n !== seen) { seen = n; paint(); }
    }
  }

  // View order: open Orders, search for this order and open its Details
  function viewOrder(ref) {
    const o = orderOf(ref); if (!o) return;
    const shownId = String(o.display_id || o.order_id);
    if (window.PB_nav && PB_nav.go) PB_nav.go('orders');
    let tries = 0;
    (function step() {
      const s = $('ohSearch'), allBtn = document.querySelector('#ohFilters .pb-oh-f[data-st="All"]');
      if (s) {
        if (allBtn && !allBtn.classList.contains('active')) allBtn.click();
        s.value = shownId;
        s.dispatchEvent(new Event('input', { bubbles: true }));
        const det = document.querySelector('#ohList button[data-det="' + String(o.order_id).replace(/"/g, '') + '"]');
        if (det) { if (det.getAttribute('aria-expanded') !== 'true') det.click(); return; }
      }
      if (++tries < 12) setTimeout(step, 250);
    })();
  }

  function wire() {
    if (!$('refunds-view')) return;
    document.addEventListener('pb:refunds-open', () => load(false));
    $('rfdSearch').addEventListener('input', () => { shown = PAGE; paint(); });
    $('rfdPills').addEventListener('click', (e) => {
      const b = e.target.closest('.rf-rf-pill'); if (!b) return;
      filter = b.dataset.f; shown = PAGE;
      document.querySelectorAll('#rfdPills .rf-rf-pill').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      paint();
    });
    $('rfdMore').addEventListener('click', () => { shown += PAGE; paint(); });
    $('rfdLogin').addEventListener('click', () => { const b = $('navWalletBtn'); if (b) b.click(); });
    $('rfdList').addEventListener('click', (e) => {
      const cp = e.target.closest('[data-copy]');
      if (cp) {
        const span = cp.querySelector('span');
        try { navigator.clipboard.writeText(cp.getAttribute('data-copy')).then(() => { if (span) { span.textContent = 'Copied'; setTimeout(() => { span.textContent = 'Copy'; }, 900); } }, () => {}); } catch (_) {}
        return;
      }
      const v = e.target.closest('[data-view]');
      if (v) viewOrder(v.getAttribute('data-view'));
    });
    // dismissible note (remembered on this device)
    const ban = $('rfdBanner');
    try { if (localStorage.getItem(LS_BANNER) === '1') ban.hidden = true; } catch (e) {}
    $('rfdBannerX').addEventListener('click', () => { ban.hidden = true; try { localStorage.setItem(LS_BANNER, '1'); } catch (e) {} });
    // quiet refresh while the page is open
    setInterval(() => {
      const v = $('refunds-view');
      if (!v || v.style.display === 'none' || document.visibilityState !== 'visible' || loading) return;
      load(true);
    }, 60000);
  }
  wire();
  // deep link /#refunds (the sidebar router ran before this file loaded)
  if ((location.hash || '') === '#refunds') load(false);
})();
