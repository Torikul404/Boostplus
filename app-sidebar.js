/* ==========================================================
   app-sidebar.js — Layer 1: the slide-in sidebar menu and the tiny
   router that opens the pages (New Order, Contact us, Tickets).
   Depends on: the .main-tab tab system in app-catalog.js.
   Exposes: window.PB_nav = { go(name), openSidebar(), closeSidebar() }
   ধাপ ২৯: ≥১০২৪ px-এ সাইডবার স্থায়ী (CSS); এই ফাইল তখন ড্রয়ারের অবস্থা (open/inert/scroll-lock) ছেড়ে দেয়।
   ========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const sidebar = $('pbSidebar');
  const overlay = $('pbSidebarOverlay');
  const menuBtn = $('pbMenuBtn');
  const closeBtn = $('pbSidebarClose');
  if (!sidebar || !overlay || !menuBtn) return;

  const items = sidebar.querySelectorAll('.pb-side-item[data-go]');
  let lastFocus = null;

  // ---------- ধাপ ২৯: ডেস্কটপে স্থায়ী মোড (design/sidebar.css-এর ১০২৪ px-এর সাথে মিলিয়ে) ----------
  const permanentMq = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : null;
  const isPermanent = () => !!(permanentMq && permanentMq.matches);

  /** স্থায়ী মোডে ড্রয়ারের সব অবস্থা মুছে সাইডবার সক্রিয় রাখে; ছোট পর্দায় ফিরলে বন্ধ ড্রয়ার। */
  function syncMode() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    overlay.hidden = true;
    document.body.classList.remove('pb-no-scroll');
    menuBtn.setAttribute('aria-expanded', 'false');
    // aria-hidden বদলালে app-a11y.js নিজেই inert বসায়/সরায়
    sidebar.setAttribute('aria-hidden', isPermanent() ? 'false' : 'true');
    if (isPermanent()) sidebar.removeAttribute('inert');
  }

  // ---------- open / close ----------
  function openSidebar() {
    if (isPermanent()) return;   // স্থায়ী সাইডবার সবসময় খোলা
    lastFocus = document.activeElement;
    overlay.hidden = false;
    // next frame so the CSS transition runs
    requestAnimationFrame(() => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
    });
    sidebar.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('pb-no-scroll');
    document.dispatchEvent(new CustomEvent('pb:sidebar-open'));
    const first = sidebar.querySelector('.pb-side-item');
    if (first) first.focus({ preventScroll: true });
  }

  function closeSidebar() {
    if (isPermanent()) return;   // স্থায়ী সাইডবার বন্ধ হয় না; aria-hidden/inert ছোঁয়া হয় না, ফোকাস যেখানে ছিল সেখানেই
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    sidebar.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('pb-no-scroll');
    setTimeout(() => { if (!sidebar.classList.contains('open')) overlay.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // ---------- active item highlight ----------
  function setActive(name) {
    items.forEach((el) => el.classList.toggle('active', el.dataset.go === name));
  }

  // ---------- routing ----------
  function scrollToApp() {
    const app = $('app');
    if (app) app.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setHash(hash) {
    try {
      history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
    } catch (_) { /* file:// etc. — harmless */ }
  }

  /** Reset to the normal tab system (also cancels any half-finished order
   *  flow / timers, exactly like tapping the New Order tab does). */
  function resetToServices() {
    const tab = document.querySelector('.main-tab[data-view="services"]');
    if (tab) tab.click();
  }

  function showExtraView(viewId) {
    resetToServices();
    const services = $('services-view');
    if (services) services.style.display = 'none';
    // Neither tab is "current" while a sidebar page is showing
    document.querySelectorAll('.main-tab, .site-nav-tab').forEach((b) => {
      b.classList.remove('active');
      if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false');
    });
    const view = $(viewId);
    if (view) view.style.display = 'block';
  }

  function go(name) {
    closeSidebar();
    switch (name) {
      case 'how': {
        resetToServices();
        setHash('');
        setActive('how');
        const sec = $('howItWorksSection');
        // wait one frame so the scroll lock is released before scrolling
        requestAnimationFrame(() => sec && sec.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        break;
      }
      case 'new-order':
        resetToServices();
        setHash('');
        setActive('new-order');
        requestAnimationFrame(scrollToApp);
        break;
      case 'orders':
        showExtraView('orders-view');
        setHash('orders');
        setActive('orders');
        document.dispatchEvent(new CustomEvent('pb:orders-open'));
        requestAnimationFrame(scrollToApp);
        break;
      case 'rules':
        showExtraView('rules-view');
        setHash('rules');
        setActive('rules');
        requestAnimationFrame(scrollToApp);
        break;
      case 'contact':
        showExtraView('contact-view');
        setHash('contact');
        setActive('contact');
        requestAnimationFrame(scrollToApp);
        break;
      case 'account':
        showExtraView('account-view');
        setHash('account');
        setActive('account');
        document.dispatchEvent(new CustomEvent('pb:account-open'));
        requestAnimationFrame(scrollToApp);
        break;
      case 'tickets':
        showExtraView('tickets-view');
        setHash('tickets');
        setActive('tickets');
        document.dispatchEvent(new CustomEvent('pb:tickets-open'));
        requestAnimationFrame(scrollToApp);
        break;
    }
  }

  // ---------- wiring ----------
  menuBtn.addEventListener('click', () => (sidebar.classList.contains('open') ? closeSidebar() : openSidebar()));
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });
  items.forEach((el) => el.addEventListener('click', () => go(el.dataset.go)));

  // The external WhatsApp Channel link just needs the drawer to close.
  const wa = $('pbSideWaChannel');
  if (wa) {
    if (window.PB_SUPPORT && window.PB_SUPPORT.whatsappGroup) wa.href = window.PB_SUPPORT.whatsappGroup;
    wa.addEventListener('click', () => setTimeout(closeSidebar, 0));
  }

  // Tapping a normal tab (New Order / Track order) clears the sidebar highlight
  document.querySelectorAll('.main-tab, .site-nav-tab').forEach((b) =>
    b.addEventListener('click', () => { setActive(null); setHash(''); })
  );

  // Deep links: /#tickets, /#contact and /#rules
  function routeFromHash() {
    const h = (location.hash || '').replace('#', '');
    if (h === 'tickets' || h === 'contact' || h === 'rules' || h === 'orders' || h === 'account') go(h);
  }
  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();

  const r2t = $('rulesToTickets');
  if (r2t) r2t.addEventListener('click', () => go('tickets'));

  syncMode();
  if (permanentMq) {
    if (permanentMq.addEventListener) permanentMq.addEventListener('change', syncMode);
    else if (permanentMq.addListener) permanentMq.addListener(syncMode);   // পুরনো Safari
  }

  window.PB_nav = { go, openSidebar, closeSidebar };
})();
