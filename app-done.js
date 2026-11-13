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

  function ago(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'এইমাত্র';
    const m = Math.floor(s / 60);
    if (m < 60) return bn(m) + ' মিনিট আগে';
    const h = Math.floor(m / 60);
    if (h < 24) return bn(h) + ' ঘণ্টা আগে';
    return bn(Math.floor(h / 24)) + ' দিন আগে';
  }

  function render(d) {
    const body = $('dnBody');
    const items = (d && d.items) || [];
    if (d && d.total_done) { $('dnTotalN').textContent = bn(d.total_done); $('dnTotal').hidden = false; }
    if (!items.length) { body.innerHTML = '<tr><td colspan="4" class="dn-msg">এখনো কোনো সম্পন্ন অর্ডার নেই।</td></tr>'; return; }
    body.innerHTML = items.map((x) =>
      '<tr><td class="dn-code">' + esc(x.code) + '</td>' +
      '<td class="dn-name">' + esc(x.name || '—') + '</td>' +
      '<td class="dn-qty">' + esc(Number(x.qty).toLocaleString('en-US')) + '</td>' +
      '<td class="dn-time">' + (x.took
        ? '<span class="dn-fast" title="অর্ডার থেকে সম্পন্ন পর্যন্ত সময়">⚡ ' + esc(x.took) + ' এ সম্পন্ন</span>'
        : esc(ago(x.at))) + '</td></tr>'
    ).join('');
    const note = $('dnNote');
    if (d.fast_min) { note.textContent = '⚡ চিহ্নিত অর্ডারগুলো ' + bn(d.fast_min) + ' মিনিটের মধ্যে সম্পন্ন হয়েছে; বাকিগুলোতে কত আগে সম্পন্ন হয়েছে তা দেখানো হলো।'; note.hidden = false; }
  }

  async function load(force) {
    if (loading) return;
    if (!force && loadedAt && Date.now() - loadedAt < 60000) return;
    const api = apiUrl();
    if (!api) { $('dnBody').innerHTML = '<tr><td colspan="4" class="dn-msg">তালিকা এখন লোড করা যাচ্ছে না।</td></tr>'; return; }
    loading = true;
    try {
      const res = await fetch(api + (api.indexOf('?') >= 0 ? '&' : '?') + 'action=done_list', { method: 'GET', cache: 'no-store' });
      const d = await res.json();
      if (!d || !d.ok) throw new Error('bad');
      render(d);
      loadedAt = Date.now();
    } catch (e) {
      $('dnBody').innerHTML = '<tr><td colspan="4" class="dn-msg">লোড করা যায়নি। একটু পরে আবার চেষ্টা করুন।</td></tr>';
    } finally { loading = false; }
  }

  document.addEventListener('pb:done-open', () => load(false));
})();
