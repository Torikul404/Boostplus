/* ==========================================================
   app-done.js — "সম্পন্ন অর্ডার" ট্যাব (পাবলিক, লগইন লাগে না)
   Backend: GET <api>?action=done_list
   দেখায়: সার্ভিস কোড, সার্ভিসের নাম, পরিমাণ, সময়।
   অর্ডার দ্রুত (সীমার মধ্যে) সম্পন্ন হলে "কত সময়ে হয়েছে" দেখায়, নইলে কত আগে সম্পন্ন হয়েছে।
   ========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const apiUrl = () => (typeof sheetApi === 'function' ? sheetApi() : '') || window.BOOSTPLUS_SHEET_API || '';
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bn = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
  let loadedAt = 0, loading = false;

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
  // প্ল্যাটফর্ম আইকন: নতুন-অর্ডার পাতার প্ল্যাটফর্ম-বার থেকে কপি
  function platInfo(key) {
    const btn = key ? document.querySelector('#services-view .platform-bar .platform-btn[data-platform="' + key + '"]') : null;
    const sv = btn && btn.querySelector('svg');
    return {
      label: (btn && (btn.getAttribute('aria-label') || btn.getAttribute('title'))) || (key ? key.charAt(0).toUpperCase() + key.slice(1) : ''),
      icon: sv ? '<span class="dn-pf">' + sv.outerHTML.replace(/id="/g, 'id="dn-').replace(/url\(#/g, 'url(#dn-').replace(/href="#/g, 'href="#dn-') + '</span>' : ''
    };
  }

  function render(d) {
    const box = $('dnList');
    const items = ((d && d.items) || []).filter((x) => x.took);   // শুধু দ্রুত সম্পন্ন
    if (!items.length) { box.innerHTML = '<div class="dn-msg">এখনো কোনো সম্পন্ন অর্ডার নেই।</div>'; return; }
    box.innerHTML = items.map((x) => {
      const p = pkgOf(x.code), pf = platInfo(p && p.platform);
      let nm = x.name || '—';
      try { if (p && typeof pbDropdownName === 'function') nm = pbDropdownName(p) || nm; } catch (e) {}
      const svc = p ? [pf.label, p.category].filter(Boolean).join(' · ') : '';
      return '<article class="dn-card">' +
        '<div class="dn-top">' + pf.icon + '<span class="dn-code">#' + esc(x.code) + '</span>' +
          '<button type="button" class="dn-copy" data-copy="' + esc(x.code) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>Copy</span></button></div>' +
        '<h3 class="dn-name">' + esc(x.code) + ' – ' + esc(nm) + '</h3>' +
        '<div class="dn-acts"><span class="dn-badge">✔ Completed</span>' +
          '<button type="button" class="dn-buy" data-buy="' + esc(x.code) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="18" cy="20" r="1.5" fill="currentColor"/><path d="M3 4h2.5l2.2 11h10.3l2-8H6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Buy now</span></button></div>' +
        '<div class="dn-grid">' +
          '<div class="dn-tile"><small>DELIVERED</small><b>' + esc(when(x.at)) + '</b></div>' +
          '<div class="dn-tile"><small>QUANTITY</small><b>' + esc(Number(x.qty).toLocaleString('en-US')) + '</b></div>' +
          '<div class="dn-tile"><small>COMPLETED IN</small><b class="dn-fast">' + esc(x.took) + '</b></div>' +
          (svc ? '<div class="dn-tile"><small>SERVICE</small><b>' + esc(svc) + '</b></div>' : '') +
        '</div></article>';
    }).join('');
  }

  document.addEventListener('click', (e) => {
    const cp = e.target.closest && e.target.closest('#dnList [data-copy]');
    if (cp) {
      const span = cp.querySelector('span');
      try { navigator.clipboard.writeText(cp.getAttribute('data-copy')).then(() => { if (span) { span.textContent = '✓'; setTimeout(() => { span.textContent = 'Copy'; }, 900); } }, () => {}); } catch (_) {}
      return;
    }
    const by = e.target.closest && e.target.closest('#dnList [data-buy]');
    if (by) {
      const code = by.getAttribute('data-buy');
      if (window.PB_nav && PB_nav.go) PB_nav.go('new-order');
      setTimeout(() => { try { pickSearchResult(code); } catch (err) { console.warn('done buy:', err); } }, 160);
    }
  });

  async function load(force) {
    if (loading) return;
    if (!force && loadedAt && Date.now() - loadedAt < 60000) return;
    const api = apiUrl();
    if (!api) { $('dnList').innerHTML = '<div class="dn-msg">তালিকা এখন লোড করা যাচ্ছে না।</div>'; return; }
    loading = true;
    try {
      const res = await fetch(api + (api.indexOf('?') >= 0 ? '&' : '?') + 'action=done_list', { method: 'GET', cache: 'no-store' });
      const d = await res.json();
      if (!d || !d.ok) throw new Error('bad');
      render(d);
      loadedAt = Date.now();
    } catch (e) {
      $('dnList').innerHTML = '<div class="dn-msg">লোড করা যায়নি। একটু পরে আবার চেষ্টা করুন।</div>';
    } finally { loading = false; }
  }

  document.addEventListener('pb:done-open', () => load(false));
})();
