/* ==========================================================
   app-popup.js — Layer 5: the "Stay Connected" popup.
   Invites first-time visitors to the WhatsApp group (and Telegram, if
   PB_SUPPORT.telegram is set). Shown once, a few seconds after load, and
   again only after 7 days. Never shown while another panel is open.
   Depends on: app-core.js (PB_SUPPORT).
   ========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const modal = $('pbConnectModal');
  if (!modal) return;

  const KEY = 'pb_connect_seen_v1';
  const DELAY_MS = 6000;
  const REPEAT_MS = 7 * 24 * 3600 * 1000;

  const cfg = window.PB_SUPPORT || {};
  if (cfg.whatsappGroup) $('pbConnectWa').href = cfg.whatsappGroup;
  if (cfg.telegram) { $('pbConnectTg').href = cfg.telegram; $('pbConnectTg').hidden = false; }

  function lastSeen() { try { return Number(localStorage.getItem(KEY)) || 0; } catch (_) { return 0; } }
  function markSeen() { try { localStorage.setItem(KEY, String(Date.now())); } catch (_) {} }

  function open() { modal.hidden = false; requestAnimationFrame(() => modal.classList.add('show')); $('pbConnectClose').focus({ preventScroll: true }); }
  function close() {
    markSeen();
    modal.classList.remove('show');
    setTimeout(() => { modal.hidden = true; }, 200);
  }

  $('pbConnectClose').addEventListener('click', close);
  $('pbConnectLater').addEventListener('click', close);
  $('pbConnectWa').addEventListener('click', markSeen);
  $('pbConnectTg').addEventListener('click', markSeen);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  if (Date.now() - lastSeen() < REPEAT_MS) return;
  setTimeout(() => {
    // Don't interrupt: sidebar open, a form being typed in, or a checkout in progress
    const sidebarOpen = document.getElementById('pbSidebar')?.classList.contains('open');
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    const checkout = ['waiting-view', 'submit-trx-view'].some((id) => {
      const n = $(id); return n && n.style.display && n.style.display !== 'none';
    });
    if (sidebarOpen || typing || checkout) return;
    open();
  }, DELAY_MS);
})();
