// ─── Navegación ───────────────────────────────────────────────────────────────

function setupNav() {
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sec = document.getElementById('section-' + btn.dataset.section);
      if (sec) sec.classList.add('active');
      if (btn.dataset.section === 'dashboard')   renderDashboard().catch(console.error);
      if (btn.dataset.section === 'products')    renderAdminProducts().catch(console.error);
      if (btn.dataset.section === 'inventory')   renderInventorySection().catch(console.error);
      if (btn.dataset.section === 'orders')      renderOrdersSection().catch(console.error);
      if (btn.dataset.section === 'users')       renderUsersSection().catch(console.error);
      if (btn.dataset.section === 'accounting')  renderAccountingSection().catch(console.error);
      if (btn.dataset.section === 'stats')       renderStatsSection().catch(console.error);
      if (btn.dataset.section === 'caja')        renderCajaSection().catch(console.error);
      if (btn.dataset.section === 'tools')       setupToolsSection().catch(console.error);
      if (btn.dataset.section === 'precios')     renderPreciosSection().catch(console.error);
      if (btn.dataset.section === 'combos')      renderAdminCombos().catch(console.error);
    });
  });
}

function setupSidebarControls() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle = document.getElementById('sidebarToggle');
  if (!sidebar || !overlay || !toggle) return;

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  let _sidebarScrollY = 0;

  const openSidebar = () => {
    if (!isMobile()) return;
    _sidebarScrollY = window.scrollY;
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    toggle.setAttribute('aria-expanded', 'true');
    // Truco para bloquear scroll en iOS Safari (overflow:hidden no funciona en iOS)
    document.body.style.position = 'fixed';
    document.body.style.top      = `-${_sidebarScrollY}px`;
    document.body.style.width    = '100%';
  };

  const closeSidebar = () => {
    const wasOpen = sidebar.classList.contains('open');
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    toggle.setAttribute('aria-expanded', 'false');
    // Restaurar scroll position exacta al cerrar (solo si el sidebar estaba abierto)
    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.width    = '';
    if (wasOpen) window.scrollTo(0, _sidebarScrollY);
  };

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) closeSidebar();
  });

  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isMobile()) closeSidebar();
    });
  });
}
