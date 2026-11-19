/* ==========================================================
   app-done.js — "Order Statistics" (public feed, no login needed)
   Backend (unchanged): GET <api>?action=done_list
   Shows: service ID, service name, quantity, delivered time, completed-in time.
   R16: card template rebuilt, search added, header buttons wired.
   Customer names, order IDs and links are never shown (privacy).
   ========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const apiUrl = () => (typeof sheetApi === 'function' ? sheetApi() : '') || window.BOOSTPLUS_SHEET_API || '';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let loadedAt = 0, loading = false, feed = [];

  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function when(iso) {
    const t = Date.parse(iso);
    if (!t) return '—';
    const d = new Date(t + 6 * 3600000);   // Asia/Dhaka
    const p2 = (n) => (n < 10 ? '0' : '') + n;
    return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes());
  }

  function pkgOf(code) {
    try { return (typeof allPackages !== 'undefined' ? allPackages : []).find((p) => String(p.code) === String(code)) || null; } catch (e) { return null; }
  }
  // platform icon: copied from the New order platform bar (same icons, no new assets)
  function platInfo(key) {
    const btn = key ? document.querySelector('#services-view .platform-bar .platform-btn[data-platform="' + key + '"]') : null;
    const sv = btn && btn.querySelector('svg');
    return {
      label: (btn && (btn.getAttribute('aria-label') || btn.getAttribute('title'))) || (key ? key.charAt(0).toUpperCase() + key.slice(1) : ''),
      icon: sv ? sv.outerHTML.replace(/id="/g, 'id="dn-').replace(/url\(#/g, 'url(#dn-').replace(/href="#/g, 'href="#dn-') : ''
    };
  }
  const CHECK = '<svg class="rf-dn-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>';
  const COPY = '<svg class="rf-dn-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  const CART = '<svg class="rf-dn-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2.5l2.2 11h10.3l2-8H6.5"/></svg>';

  // everything a card and the search need, resolved at paint time
  // (the service catalog may finish loading after the feed does)
  function prep(x) {
    const p = pkgOf(x.code), pf = platInfo(p && p.platform);
    let nm = x.name || '—';
    try { if (p && typeof pbDropdownName === 'function') nm = pbDropdownName(p) || nm; } catch (e) {}
    const svc = p ? [pf.label, p.category].filter(Boolean).join(' · ') : '';
    return { x, nm, svc, icon: pf.icon, hay: (String(x.code) + ' ' + nm + ' ' + (x.name || '') + ' ' + svc).toLowerCase() };
  }

  function card(r) {
    const x = r.x;
    return '<article class="rf-card rf-dn-card">' +
      '<div class="rf-dn-top"><span class="rf-dn-pf' + (r.icon ? '' : ' rf-dn-pf--ic') + '">' + (r.icon || CHECK) + '</span>' +
        '<span class="rf-chip rf-chip--id">#' + esc(x.code) + '</span>' +
        '<button type="button" class="rf-button rf-button--outline rf-button--sm rf-dn-copy" data-copy="' + esc(x.code) + '">' + COPY + '<span>Copy</span></button></div>' +
      '<h3 class="rf-dn-name">' + esc(x.code) + ' – ' + esc(r.nm) + '</h3>' +
      '<div class="rf-dn-acts"><span class="rf-pill rf-pill--completed">Completed</span>' +
        '<button type="button" class="rf-button rf-button--primary rf-dn-buy" data-buy="' + esc(x.code) + '">' + CART + '<span>Buy now</span></button></div>' +
      '<div class="rf-dn-grid">' +
        '<div class="rf-dn-tile"><small>Delivered</small><b>' + esc(when(x.at)) + '</b></div>' +
        '<div class="rf-dn-tile"><small>Quantity</small><b>' + esc(Number(x.qty).toLocaleString('en-US')) + '</b></div>' +
        '<div class="rf-dn-tile"><small>Completed in</small><b class="rf-dn-fast">' + esc((window.pbTookEn || String)(x.took)) + '</b></div>' +
        (r.svc ? '<div class="rf-dn-tile"><small>Service</small><b>' + esc(r.svc) + '</b></div>' : '') +
      '</div></article>';
  }

  function msg(t) { $('dnList').innerHTML = '<div class="rf-dn-msg" role="status">' + esc(t) + '</div>'; }
  function setCount(txt) { const c = $('dnCount'); if (!c) return; c.textContent = txt || ''; c.hidden = !txt; }

  function paint() {
    const q = (($('dnSearch') && $('dnSearch').value) || '').trim().toLowerCase().replace(/^#/, '');
    if (!feed.length) { setCount(''); msg('No completed orders to show yet.'); return; }
    const all = feed.map(prep);
    const rows = q ? all.filter((r) => r.hay.indexOf(q) >= 0) : all;
    setCount(q ? rows.length + ' of ' + feed.length + ' orders' : feed.length + ' recent orders');
    if (!rows.length) { msg('No orders match your search. Try a service ID or a shorter name.'); return; }
    $('dnList').innerHTML = rows.map(card).join('');
  }

  function render(d) {
    const items = ((d && d.items) || []).filter((x) => x.took);   // only orders with a real completion time
    feed = items;
    paint();
  }

  document.addEventListener('click', (e) => {
    const cp = e.target.closest && e.target.closest('#dnList [data-copy]');
    if (cp) {
      const span = cp.querySelector('span');
      try { navigator.clipboard.writeText(cp.getAttribute('data-copy')).then(() => { if (span) { span.textContent = 'Copied'; setTimeout(() => { span.textContent = 'Copy'; }, 900); } }, () => {}); } catch (_) {}
      return;
    }
    const by = e.target.closest && e.target.closest('#dnList [data-buy]');
    if (by) {
      const code = by.getAttribute('data-buy');
      if (window.PB_nav && PB_nav.go) PB_nav.go('new-order');
      setTimeout(() => { try { pickSearchResult(code); } catch (err) { console.warn('done buy:', err); } }, 160);
      return;
    }
    const nav = e.target.closest && e.target.closest('#dnNew, #dnMy, #dnFind');
    if (nav && window.PB_nav && PB_nav.go) PB_nav.go(nav.id === 'dnNew' ? 'new-order' : nav.id === 'dnMy' ? 'orders' : 'services');
  });

  const sIn = $('dnSearch');
  if (sIn) sIn.addEventListener('input', paint);

  async function load(force) {
    if (loading) return;
    if (!force && loadedAt && Date.now() - loadedAt < 60000) { paint(); return; }
    const api = apiUrl();
    if (!api) { setCount(''); msg('The list cannot be loaded right now.'); return; }
    loading = true;
    try {
      const res = await fetch(api + (api.indexOf('?') >= 0 ? '&' : '?') + 'action=done_list', { method: 'GET', cache: 'no-store' });
      const d = await res.json();
      if (!d || !d.ok) throw new Error('bad');
      render(d);
      loadedAt = Date.now();
    } catch (e) {
      feed = []; setCount(''); msg('Could not load. Please try again in a moment.');
    } finally { loading = false; }
  }

  document.addEventListener('pb:done-open', () => load(false));
})();
