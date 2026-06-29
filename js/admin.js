// ─── Panel Administrador — MICHT Decants ─────────────────────────────────────

// ─── Verificación de acceso admin ────────────────────────────────────────────
// La lista de admins se gestiona en Supabase Dashboard → Authentication → Users
// → clic en el usuario → editar "app_metadata" → agregar: {"role":"admin"}
// Así no hay correos ni datos sensibles en el código ni en el repositorio.
function isAdminUser(user) {
  return user?.app_metadata?.role === 'admin';
}

let _adminProductSearch = '';
let _adminProductTypeFilter = 'all';
let _adminPage  = 1;
const _ADMIN_PAGE_SIZE = 12;
let _customerHistory = [];
let _orderSearch = '';
let _userSearch  = '';

const CAMPAIGN_LABELS = {
  'default':         'Diseño normal',
  'dia-madre':       'Día de la Madre',
  'dia-padre':       'Día del Padre',
  'san-juan':        'San Juan',
  'navidad':         'Navidad',
  'fiestas-patrias': 'Fiestas Patrias',
  'san-valentin':    'San Valentín',
  'halloween':       'Halloween',
  'anio-nuevo':      'Año Nuevo'
};

function withTimeout(promise, ms, label = 'operacion') {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`Tiempo de espera agotado al cargar ${label}.`)), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timerId)),
    timeout
  ]);
}

function setAdminErrorState(containerId, title, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;color:var(--text2);padding:2rem;background:var(--card);border:1px solid rgba(239,83,80,.35);border-radius:var(--r-lg)">
      <div style="font-size:1.4rem;color:var(--red);margin-bottom:.5rem">⚠</div>
      <div style="color:var(--white);font-weight:600;margin-bottom:.25rem">${sanitize(title)}</div>
      <div style="font-size:.84rem;line-height:1.6">${sanitize(message)}</div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!SUPABASE_READY) {
      showNoDbScreen();
      return;
    }

    const sessionResult = await withTimeout(db.auth.getSession(), 12000, 'la sesión de admin');
    const session = sessionResult?.data?.session;
    if (!session) { showLoginScreen(); return; }

    // Ruta rápida: el JWT ya tiene app_metadata si el token se renovó después
    // de ejecutar el SQL. Si no lo tiene, se verifica con getUser() (más lento).
    if (isAdminUser(session.user)) {
      await showDashboard();
    } else {
      // Token viejo — verificar con datos frescos del servidor
      const userResult = await withTimeout(db.auth.getUser(), 12000, 'la verificación del usuario');
      const user = userResult?.data?.user;
      const userErr = userResult?.error;
      if (userErr || !isAdminUser(user)) {
        await db.auth.signOut();
        showLoginScreen();
        const errEl = document.getElementById('loginError');
        if (errEl) { errEl.textContent = 'Acceso denegado. Esta cuenta no tiene permisos de administrador.'; errEl.style.display = 'block'; }
      } else {
        await showDashboard();
      }
    }
  } catch (err) {
    console.error('[MICHT] Error inicializando admin:', err);
    showLoginScreen();
    const errEl = document.getElementById('loginError');
    if (errEl) {
      errEl.textContent = 'No se pudo cargar el acceso al admin. Recarga la página e inténtalo otra vez.';
      errEl.style.display = 'block';
    }
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await db.auth.signOut();
    showLoginScreen();
  });
});

// ─── Auth screens ─────────────────────────────────────────────────────────────

function showLoginScreen() {
  document.getElementById('loginSection').style.display    = 'flex';
  document.getElementById('dashboardSection').style.display = 'none';
  const form      = document.getElementById('loginForm');
  const set       = document.getElementById('setPasswordForm');
  const emailWrap = document.getElementById('loginEmailWrap');
  // Solo Supabase Auth — siempre pide correo + contraseña
  form.style.display = 'block';
  set.style.display  = 'none';
  if (emailWrap) emailWrap.style.display = 'block';
  form.onsubmit = handleLogin;
}

function showNoDbScreen() {
  document.getElementById('loginSection').style.display     = 'flex';
  document.getElementById('dashboardSection').style.display = 'none';
  const box = document.createElement('div');
  box.style.cssText = 'text-align:center;padding:2rem;color:var(--text2);max-width:360px;margin:auto';
  box.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:1rem">⚠️</div>
    <h2 style="color:var(--gold);margin-bottom:.5rem">Sin conexión</h2>
    <p style="font-size:.9rem;line-height:1.6">
      No se pudo conectar con la base de datos.<br>
      Verifica tu conexión a internet y recarga la página.
    </p>
    <button onclick="location.reload()" style="margin-top:1.5rem;padding:.6rem 1.5rem;background:var(--gold);color:#111;border:none;border-radius:6px;font-weight:700;cursor:pointer">
      Recargar
    </button>
  `;
  document.getElementById('loginSection').innerHTML = '';
  document.getElementById('loginSection').appendChild(box);
}

let _dashboardReady = false;

async function showDashboard() {
  document.getElementById('loginSection').style.display    = 'none';
  document.getElementById('dashboardSection').style.display = 'block';

  if (!_dashboardReady) {
    _dashboardReady = true;
    setupAdminEvents();
    setupOrderEvents();
    setupUsersEvents();
    setupAccountingEvents();
    setupPreciosEvents();
    setupNav();
    setupSidebarControls();
  }

  renderAdminProducts().catch(err => {
    console.error('[MICHT] Error cargando perfumes:', err);
    setAdminErrorState('adminProductList', 'No se pudieron cargar los perfumes', 'La carga falló o tardó demasiado. Vuelve a intentar desde el panel.');
  });
  renderOrdersSection().catch(err => {
    console.error('[MICHT] Error cargando pedidos:', err);
    setAdminErrorState('ordersTableBody', 'No se pudieron cargar los pedidos', 'La tabla no pudo completarse. Recarga el panel para intentar de nuevo.');
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = (document.getElementById('loginEmail')?.value || '').trim();
  const pw    = document.getElementById('loginPassword').value;
  const err   = document.getElementById('loginError');
  err.style.display = 'none';

  if (!email) { err.textContent = 'Ingresa tu correo electrónico.'; err.style.display = 'block'; return; }
  if (!pw)    { err.textContent = 'Ingresa tu contraseña.'; err.style.display = 'block'; return; }

  const btn = e.target.querySelector('button[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

  const { data: loginData, error } = await db.auth.signInWithPassword({ email, password: pw });

  if (btn) { btn.disabled = false; btn.textContent = 'Ingresar'; }

  if (error) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.style.display = 'block';
    return;
  }

  // signInWithPassword devuelve el user con app_metadata del servidor (siempre fresco)
  if (!isAdminUser(loginData?.user)) {
    await db.auth.signOut();
    err.textContent = 'Esta cuenta no tiene permisos de administrador.';
    err.style.display = 'block';
    return;
  }

  await showDashboard();
}


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
      if (btn.dataset.section === 'inventory')   renderInventorySection().catch(console.error);
      if (btn.dataset.section === 'orders')      renderOrdersSection().catch(console.error);
      if (btn.dataset.section === 'orders')      updateOrderStats().catch(console.error);
      if (btn.dataset.section === 'users')       renderUsersSection().catch(console.error);
      if (btn.dataset.section === 'accounting')  renderAccountingSection().catch(console.error);
      if (btn.dataset.section === 'stats')       renderStatsSection().catch(console.error);
      if (btn.dataset.section === 'caja')        renderCajaSection().catch(console.error);
      if (btn.dataset.section === 'tools')       setupToolsSection().catch(console.error);
      if (btn.dataset.section === 'precios')     renderPreciosSection().catch(console.error);
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

// ─── Sección: Productos ────────────────────────────────────────────────────────

function _normAdminImg(url) {
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) return url;
  return '/' + url;
}

async function renderAdminProducts() {
  const container = document.getElementById('adminProductList');
  if (!container) return;
  container.innerHTML = `<div class="sk-products-wrap">${Array(4).fill('<div class="sk-product-card"><div class="sk-block" style="height:100px;margin-bottom:.5rem"></div><div class="sk-block" style="height:14px;width:60%;margin-bottom:.4rem"></div><div class="sk-block" style="height:12px;width:40%"></div></div>').join('')}</div>`;
  // Mostrar alerta de stock bajo
  renderLowStockBanner().catch(() => {});

  let products = await withTimeout(CloudProducts.getAll(), 15000, 'los perfumes');
  if (_adminProductTypeFilter === 'entero') {
    products = products.filter(p => p.type === 'entero');
  } else if (_adminProductTypeFilter === 'decant') {
    products = products.filter(p => p.type !== 'entero');
  }
  if (_adminProductSearch) {
    const q = _adminProductSearch.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.olfFamily || '').toLowerCase().includes(q)
    );
  }

  // ── Paginación ─────────────────────────────────────────────────────────────
  const totalProds  = products.length;
  const totalPages  = Math.max(1, Math.ceil(totalProds / _ADMIN_PAGE_SIZE));
  _adminPage        = Math.min(_adminPage, totalPages);
  const pageStart   = (_adminPage - 1) * _ADMIN_PAGE_SIZE;
  const paginated   = products.slice(pageStart, pageStart + _ADMIN_PAGE_SIZE);

  window._adminImgFallback = {};
  paginated.forEach(p => { window._adminImgFallback[p.id] = buildProductImage(p); });

  container.innerHTML = paginated.map(p => {
    const pct    = p.bottleTotalMl > 0 ? Math.round(p.bottleRemainingMl / p.bottleTotalMl * 100) : 0;
    const color  = pct > 50 ? '#4caf50' : pct > 20 ? '#ff9800' : '#ef5350';
    const typeLabel = p.type === 'arabe' ? 'Árabe' : p.type === 'entero' ? 'Entero' : 'Diseñador';
    const typeBadge = p.type === 'arabe' ? 'badge-arabe' : p.type === 'entero' ? 'badge-entero' : 'badge-dis';
    const gLabel    = { hombre: '♂ Hombre', mujer: '♀ Mujer', unisex: '⚥ Unisex' }[p.gender] || '';
    const isEntero  = p.type === 'entero';
    const isFull    = p.bottleTotalMl > 0 && p.bottleRemainingMl >= p.bottleTotalMl;
    const adminImg  = _normAdminImg(p.imageUrl) || buildProductImage(p);

    return `
    <div class="admin-card" data-id="${p.id}">
      <div class="admin-card-head">
        <img src="${escapeAttr(adminImg)}" alt="${escapeAttr(p.name)}" class="admin-product-thumb" loading="lazy"
             onerror="this.onerror=null;this.src=window._adminImgFallback[${p.id}]"
             style="object-fit:contain"  />
        <div style="flex:1;min-width:0">
          <span class="admin-type-badge ${typeBadge}">${typeLabel}</span>
          ${p.gender ? `<span style="font-size:.65rem;color:var(--text2);margin-left:.4rem">${gLabel}</span>` : ''}
          <h3 class="admin-product-name">${sanitize(p.brand)} – ${sanitize(p.name)}</h3>
          ${p.contentDescription ? `<p style="font-size:.72rem;color:var(--gold);margin-top:.2rem">📦 ${sanitize(p.contentDescription)}</p>` : ''}
          ${p.olfFamily ? `<p style="font-size:.72rem;color:var(--gold-d);margin-top:.15rem">${sanitize(p.olfFamily)}</p>` : ''}
        </div>
        <div class="admin-card-actions">
          <button class="btn-edit"   data-id="${p.id}">Editar</button>
          <button class="btn-delete" data-id="${p.id}">Eliminar</button>
        </div>
      </div>
      <div class="admin-card-body">

        <!-- Toggle de stock -->
        <div class="admin-info-row">
          <label class="toggle-label">
            <span>Stock:</span>
            <label class="toggle">
              <input type="checkbox" class="stock-toggle" data-id="${p.id}" ${p.inStock ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span class="stock-status ${p.inStock ? 'in-stock' : 'out-stock'}">
              ${p.inStock ? 'Disponible' : 'Agotado'}
            </span>
          </label>
        </div>

        <!-- Toggle de popular -->
        <div class="admin-info-row">
          <label class="toggle-label">
            <span>Popular:</span>
            <label class="toggle">
              <input type="checkbox" class="featured-toggle" data-id="${p.id}" ${p.featured ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span class="stock-status ${p.featured ? 'in-stock' : 'out-stock'}">
              ${p.featured ? '⭐ Popular' : 'Normal'}
            </span>
          </label>
        </div>

        <!-- Toggle "Como Entero": visible solo cuando el frasco está 100% lleno -->
        ${!isEntero && isFull ? `
        <div class="admin-info-row">
          <label class="toggle-label">
            <span>Como Entero:</span>
            <label class="toggle">
              <input type="checkbox" class="entero-avail-toggle" data-id="${p.id}" ${p.availableAsEntero ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span class="stock-status ${p.availableAsEntero ? 'in-stock' : 'out-stock'}">
              ${p.availableAsEntero ? '🛍 Visible en catálogo enteros' : 'Solo decants'}
            </span>
          </label>
        </div>
        ${p.availableAsEntero ? `
        <div class="admin-info-row" style="align-items:center;gap:.75rem;flex-wrap:wrap">
          <strong style="font-size:.76rem;color:var(--text2)">Precio entero (S/):</strong>
          <div style="display:flex;align-items:center;gap:.5rem">
            <input type="number" class="entero-price-input" data-id="${p.id}"
                   value="${p.enteroPrice || 0}" min="0" max="9999" step="0.5"
                   style="width:72px;background:transparent;border:none;border-bottom:1px solid var(--border-l);color:var(--text);font-size:.82rem;font-weight:600;padding:.1rem .2rem;outline:none;text-align:right"
                   onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border-l)'">
            <button class="btn-save-entero-price" data-id="${p.id}"
                    style="font-size:.72rem;padding:.3rem .75rem;background:var(--gold);color:#111;border:none;border-radius:var(--r);font-weight:700;cursor:pointer;transition:background .2s"
                    onmouseover="this.style.background='var(--gold-l)'" onmouseout="this.style.background='var(--gold)'">
              Guardar precio
            </button>
          </div>
        </div>` : ''}` : !isEntero && p.bottleTotalMl > 0 ? `
        <div class="admin-info-row" style="padding:.25rem 0">
          <span style="font-size:.72rem;color:var(--text3)">💡 Frasco al 100% (${p.bottleRemainingMl}/${p.bottleTotalMl} ml) para habilitar como entero</span>
        </div>` : ''}

        <!-- Precios editables inline -->
        <div class="sizes-admin">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
            <strong style="font-size:.78rem;color:var(--text2)">${isEntero ? 'Precio (S/)' : 'Precios por talla (S/)'}</strong>
            <button class="btn-save-prices" data-id="${p.id}"
                    style="font-size:.72rem;padding:.3rem .75rem;background:var(--gold);color:#111;border:none;border-radius:var(--r);font-weight:700;cursor:pointer;transition:background .2s"
                    onmouseover="this.style.background='var(--gold-l)'" onmouseout="this.style.background='var(--gold)'">
              Guardar precios
            </button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:.5rem">
            ${Object.entries(p.sizes).map(([ml, price]) => `
            <div style="display:flex;align-items:center;gap:.3rem;background:var(--bg2);border:1px solid var(--border-l);border-radius:var(--r);padding:.3rem .55rem">
              <span style="font-size:.75rem;color:var(--text2);white-space:nowrap">${sanitize(ml)}</span>
              <span style="font-size:.72rem;color:var(--text3)">S/</span>
              <input type="number" class="price-inline-input" data-id="${p.id}" data-size="${escapeAttr(ml)}"
                     value="${price}" min="0" max="9999" step="0.5"
                     style="width:64px;background:transparent;border:none;border-bottom:1px solid var(--border-l);color:var(--text);font-size:.82rem;font-weight:600;padding:.1rem .2rem;outline:none;text-align:right"
                     onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border-l)'">
            </div>`).join('')}
          </div>
        </div>

        <!-- Stock tracker — solo para Perfumes Enteros -->
        ${isEntero ? `
        <div class="ml-tracker">
          <div class="ml-label">
            <span>Stock (unidades):</span>
            <span class="ml-values"><strong>${p.stockQuantity || 0} und.</strong> disponibles</span>
          </div>
          <div class="ml-controls">
            <label>Unidades en stock:
              <input type="number" class="stock-qty-input" data-id="${p.id}"
                     value="${p.stockQuantity || 0}" min="0" max="9999" step="1">
            </label>
            <button class="btn-save-stock-qty" data-id="${p.id}">Guardar stock</button>
          </div>
        </div>` : ''}

        <!-- ML tracker — solo para decants -->
        ${!isEntero ? `
        <div class="ml-tracker">
          <div class="ml-label">
            <span>Perfume en frasco:</span>
            <span class="ml-values"><strong>${p.bottleRemainingMl} ml</strong> / ${p.bottleTotalMl} ml</span>
          </div>
          <div class="ml-bar-wrap"><div class="ml-bar" style="width:${pct}%;background:${color}"></div></div>
          <div class="ml-controls">
            <label>Restante (ml):
              <input type="number" class="ml-input" data-field="bottleRemainingMl" data-id="${p.id}"
                     value="${p.bottleRemainingMl}" min="0" max="${p.bottleTotalMl}" step="1">
            </label>
            <label>Total frasco (ml):
              <input type="number" class="ml-input" data-field="bottleTotalMl" data-id="${p.id}"
                     value="${p.bottleTotalMl}" min="0" max="9999" step="1">
            </label>
            <button class="btn-save-ml" data-id="${p.id}">Guardar ml</button>
          </div>
        </div>` : ''}

        <!-- Notas olfativas (resumen) — solo decants -->
        ${!isEntero && (p.topNotes || p.heartNotes) ? `
        <div style="font-size:.75rem;color:var(--text2);display:flex;flex-wrap:wrap;gap:.5rem">
          ${p.topNotes    ? `<span><strong style="color:var(--gold-d)">Salida:</strong> ${sanitize(p.topNotes)}</span>` : ''}
          ${p.heartNotes  ? `<span><strong style="color:var(--gold-d)">Corazón:</strong> ${sanitize(p.heartNotes)}</span>` : ''}
          ${p.baseNotes   ? `<span><strong style="color:var(--gold-d)">Fondo:</strong> ${sanitize(p.baseNotes)}</span>` : ''}
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  // Eventos
  container.querySelectorAll('.stock-toggle').forEach(chk => {
    chk.addEventListener('change', async () => {
      await CloudProducts.update(parseInt(chk.dataset.id), { inStock: chk.checked });
      renderAdminProducts().catch(console.error);
    });
  });

  container.querySelectorAll('.featured-toggle').forEach(chk => {
    chk.addEventListener('change', async () => {
      await CloudProducts.update(parseInt(chk.dataset.id), { featured: chk.checked });
      renderAdminProducts().catch(console.error);
    });
  });

  container.querySelectorAll('.entero-avail-toggle').forEach(chk => {
    chk.addEventListener('change', async () => {
      const id  = parseInt(chk.dataset.id);
      const err = await CloudProducts.update(id, { availableAsEntero: chk.checked });
      if (err) {
        showToast(`❌ Error Supabase: ${err.message || JSON.stringify(err)}`);
      } else {
        showToast(chk.checked ? '✓ Guardado en nube como entero' : '✓ Desactivado en nube');
      }
      renderAdminProducts().catch(console.error);
    });
  });

  container.querySelectorAll('.btn-save-entero-price').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = parseInt(btn.dataset.id);
      const card = btn.closest('.admin-card');
      const inp  = card.querySelector('.entero-price-input');
      const price = parseFloat(inp?.value ?? '0');
      if (isNaN(price) || price < 0) { showToast('El precio debe ser un número positivo.'); return; }
      await CloudProducts.update(id, { enteroPrice: price });
      showToast('Precio entero guardado ✓');
    });
  });

  container.querySelectorAll('.btn-save-ml').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = parseInt(btn.dataset.id);
      const card = btn.closest('.admin-card');
      const updates = {};
      let hasNegative = false;

      card.querySelectorAll('.ml-input').forEach(inp => {
        const val = parseFloat(inp.value);
        if (val < 0 || isNaN(val)) { hasNegative = true; inp.style.borderColor = '#ef5350'; }
        else { inp.style.borderColor = ''; }
        updates[inp.dataset.field] = sanitizeNum(inp.value, 0, 9999);
      });

      if (hasNegative) {
        showToast('Los ml no pueden ser negativos.');
        return;
      }

      // Restante no puede superar el Total
      const remaining = updates.bottleRemainingMl ?? 0;
      const total     = updates.bottleTotalMl     ?? 0;
      if (remaining > total && total > 0) {
        showToast('Los ml restantes no pueden superar el total del frasco.');
        return;
      }

      await CloudProducts.update(id, updates);
      renderAdminProducts().catch(console.error);
      showToast('Mililitros actualizados ✓');
    });
  });

  container.querySelectorAll('.btn-save-stock-qty').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = parseInt(btn.dataset.id);
      const card = btn.closest('.admin-card');
      const inp  = card.querySelector('.stock-qty-input');
      const qty  = parseInt(inp?.value ?? '0');
      if (isNaN(qty) || qty < 0) { showToast('La cantidad debe ser un número positivo.'); return; }
      await CloudProducts.update(id, { stockQuantity: qty, inStock: qty > 0 });
      renderAdminProducts().catch(console.error);
      showToast(`Stock actualizado: ${qty} unidad${qty !== 1 ? 'es' : ''} ✓`);
    });
  });

  container.querySelectorAll('.btn-save-prices').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const card = btn.closest('.admin-card');
      const product = await CloudProducts.getById(id);
      if (!product) return;
      const newSizes = {};
      let hasError = false;
      card.querySelectorAll('.price-inline-input').forEach(inp => {
        const size  = inp.dataset.size;
        const price = parseFloat(inp.value);
        if (isNaN(price) || price < 0) { inp.style.borderColor = '#ef5350'; hasError = true; return; }
        inp.style.borderColor = 'var(--border-l)';
        newSizes[size] = price;
      });
      if (hasError) { showToast('Los precios deben ser números positivos.'); return; }
      if (!Object.keys(newSizes).length) return;
      await CloudProducts.update(id, { sizes: newSizes });
      showToast('Precios actualizados ✓');
    });
  });

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(parseInt(btn.dataset.id)));
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este perfume del catálogo?')) return;
      await CloudProducts.delete(parseInt(btn.dataset.id));
      renderAdminProducts().catch(console.error);
      showToast('Perfume eliminado.');
    });
  });

  // ── Controles de paginación ────────────────────────────────────────────────
  let pagerEl = document.getElementById('adminPager');
  if (!pagerEl) {
    pagerEl = document.createElement('div');
    pagerEl.id = 'adminPager';
    container.parentElement.appendChild(pagerEl);
  }

  if (totalPages <= 1) {
    pagerEl.innerHTML = `<p style="text-align:center;color:var(--text3);font-size:.78rem;margin-top:.75rem">${totalProds} perfume${totalProds !== 1 ? 's' : ''} en total</p>`;
  } else {
    pagerEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:.75rem;margin-top:1rem;flex-wrap:wrap">
        <button id="pagePrev" ${_adminPage <= 1 ? 'disabled' : ''}
          style="padding:.42rem 1rem;background:var(--bg2);border:1px solid var(--border);color:var(--text2);border-radius:var(--r);font-size:.8rem;cursor:pointer;transition:all .2s;${_adminPage <= 1 ? 'opacity:.4;cursor:default' : ''}"
          onmouseover="if(!this.disabled)this.style.borderColor='var(--gold-d)'" onmouseout="this.style.borderColor='var(--border)'">← Anterior</button>

        <div style="display:flex;gap:.3rem">
          ${Array.from({length: totalPages}, (_,i) => i+1).map(pg => `
            <button class="page-num-btn" data-pg="${pg}"
              style="width:32px;height:32px;border-radius:var(--r);font-size:.78rem;font-weight:${pg===_adminPage?'700':'400'};
                     background:${pg===_adminPage?'var(--gold)':'var(--bg2)'};
                     color:${pg===_adminPage?'#111':'var(--text2)'};
                     border:1px solid ${pg===_adminPage?'var(--gold)':'var(--border)'};cursor:pointer;transition:all .15s">${pg}</button>`).join('')}
        </div>

        <button id="pageNext" ${_adminPage >= totalPages ? 'disabled' : ''}
          style="padding:.42rem 1rem;background:var(--bg2);border:1px solid var(--border);color:var(--text2);border-radius:var(--r);font-size:.8rem;cursor:pointer;transition:all .2s;${_adminPage >= totalPages ? 'opacity:.4;cursor:default' : ''}"
          onmouseover="if(!this.disabled)this.style.borderColor='var(--gold-d)'" onmouseout="this.style.borderColor='var(--border)'">Siguiente →</button>

        <span style="font-size:.75rem;color:var(--text3)">
          ${pageStart + 1}–${Math.min(pageStart + _ADMIN_PAGE_SIZE, totalProds)} de ${totalProds}
        </span>
      </div>`;

    pagerEl.querySelector('#pagePrev')?.addEventListener('click', () => {
      if (_adminPage > 1) { _adminPage--; renderAdminProducts().catch(console.error); window.scrollTo({top:0,behavior:'smooth'}); }
    });
    pagerEl.querySelector('#pageNext')?.addEventListener('click', () => {
      if (_adminPage < totalPages) { _adminPage++; renderAdminProducts().catch(console.error); window.scrollTo({top:0,behavior:'smooth'}); }
    });
    pagerEl.querySelectorAll('.page-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _adminPage = parseInt(btn.dataset.pg);
        renderAdminProducts().catch(console.error);
        window.scrollTo({top:0,behavior:'smooth'});
      });
    });
  }
}

// ─── Sección: Inventario (ml) ─────────────────────────────────────────────────

async function renderInventorySection() {
  const products = await CloudProducts.getAll();
  const list = document.getElementById('inventoryList');
  if (!list) return;
  list.innerHTML = products.map(p => {
    const pct   = p.bottleTotalMl > 0 ? Math.round(p.bottleRemainingMl / p.bottleTotalMl * 100) : 0;
    const color = pct > 50 ? '#4caf50' : pct > 20 ? '#ff9800' : '#ef5350';
    return `
    <div class="admin-card" style="margin-bottom:.75rem">
      <div class="admin-card-head">
        <div>
          <span class="admin-type-badge ${p.type === 'arabe' ? 'badge-arabe' : 'badge-dis'}">${p.type === 'arabe' ? 'Árabe' : 'Diseñador'}</span>
          <h3 class="admin-product-name">${sanitize(p.brand)} – ${sanitize(p.name)}</h3>
        </div>
        <span style="font-size:1.1rem;font-weight:700;color:${color}">${pct}%</span>
      </div>
      <div class="admin-card-body">
        <div class="ml-tracker">
          <div class="ml-label">
            <span>Restante:</span>
            <span class="ml-values"><strong>${p.bottleRemainingMl} ml</strong> / ${p.bottleTotalMl} ml</span>
          </div>
          <div class="ml-bar-wrap"><div class="ml-bar" style="width:${pct}%;background:${color}"></div></div>
          <div class="ml-controls">
            <label>Restante (ml):<input type="number" class="ml-input" data-field="bottleRemainingMl" data-id="${p.id}" value="${p.bottleRemainingMl}" min="0" max="${p.bottleTotalMl}" step="1"></label>
            <label>Total (ml):<input type="number" class="ml-input" data-field="bottleTotalMl" data-id="${p.id}" value="${p.bottleTotalMl}" min="0" max="9999" step="1"></label>
            <button class="btn-save-ml" data-id="${p.id}">Guardar</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.btn-save-ml').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const card = btn.closest('.admin-card');
      const updates = {};
      card.querySelectorAll('.ml-input').forEach(inp => { updates[inp.dataset.field] = sanitizeNum(inp.value, 0, 9999); });
      await CloudProducts.update(id, updates);
      renderInventorySection().catch(console.error);
      showToast('Inventario actualizado ✓');
    });
  });
}

// ─── Sección: Pedidos ─────────────────────────────────────────────────────────

let orderStatusFilter = 'all';

async function updateOrderStats(allOrders = null) {
  const bar = document.getElementById('orderStatsBar');
  if (!bar) return;
  try {
    const all = allOrders || await withTimeout(CloudOrders.getAll(), 15000, 'las estadísticas de pedidos');
    const stats = {
      total:     all.length,
      pendiente: all.filter(o => o.status === 'pendiente').length,
      pagado:    all.filter(o => o.status === 'pagado').length,
      cancelado: all.filter(o => o.status === 'cancelado').length,
      revenue:   all.filter(o => o.status === 'pagado').reduce((s, o) => s + o.total, 0)
    };
    bar.innerHTML = `
      <div class="stat-card"><div class="stat-val" style="color:var(--gold)">${stats.total}</div><div class="stat-label">Total</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--orange)">${stats.pendiente}</div><div class="stat-label">Pendientes</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--green)">${stats.pagado}</div><div class="stat-label">Pagados</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#ef5350">${stats.cancelado}</div><div class="stat-label">Cancelados</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--gold-d)">S/${stats.revenue.toFixed(0)}</div><div class="stat-label">Facturado</div></div>
    `;
  } catch (err) {
    console.error('[MICHT] Error cargando resumen de pedidos:', err);
    bar.innerHTML = '<div class="stat-card" style="grid-column:1/-1;text-align:center;color:var(--text2)">No se pudo cargar el resumen de pedidos.</div>';
  }
}

async function renderOrdersSection() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem">Cargando pedidos…</td></tr>';

  try {
    // Una sola query a Supabase — se reutiliza para stats y tabla
    let orders = await withTimeout(CloudOrders.getAll(), 15000, 'los pedidos');
    await updateOrderStats(orders);

    // Aviso diagnóstico — siempre visible para saber de dónde vienen los datos
    const dbWarningId = 'supabase-orders-warning';
    const existingWarn = document.getElementById(dbWarningId);
    if (existingWarn) existingWarn.remove();
    const diagBox = document.createElement('div');
    diagBox.id = dbWarningId;
    if (!CloudOrders._lastFetchFromSupabase) {
      diagBox.style.cssText = 'background:rgba(239,83,80,.12);border:1px solid rgba(239,83,80,.4);border-radius:var(--r);padding:.7rem 1rem;margin-bottom:.75rem;font-size:.82rem;color:#ef5350';
      const errMsg = CloudOrders._lastFetchError ? `<br><small style="opacity:.8">Detalle: ${sanitize(CloudOrders._lastFetchError)}</small>` : '';
      diagBox.innerHTML = `⛔ ERROR: Supabase no respondió — mostrando solo los ${orders.length} pedidos guardados localmente. Los pedidos de Supabase NO se pueden cargar.${errMsg}<br><button onclick="location.reload()" style="margin-top:.5rem;padding:.3rem .8rem;background:#ef5350;color:#fff;border:none;border-radius:4px;font-size:.78rem;cursor:pointer;font-weight:700">Recargar página</button>`;
    } else {
      diagBox.style.cssText = 'background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.3);border-radius:var(--r);padding:.5rem 1rem;margin-bottom:.75rem;font-size:.78rem;color:#81c784';
      diagBox.innerHTML = `✓ Conectado a Supabase — ${CloudOrders._lastFetchCount} pedidos cargados correctamente`;
    }
    tbody.parentElement.insertBefore(diagBox, tbody.parentElement.firstChild);

    if (orderStatusFilter !== 'all') orders = orders.filter(o => o.status === orderStatusFilter);
    if (_orderSearch) {
      const q = _orderSearch.toLowerCase();
      orders = orders.filter(o =>
        (o.customerName  || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (o.customerDni   || '').includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    }

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:2rem">No hay pedidos ${_orderSearch ? 'que coincidan con la búsqueda' : orderStatusFilter !== 'all' ? 'con ese estado' : 'registrados'}</td></tr>`;
      return;
    }

    const STATUS_LABELS = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };
    const SELECT_OPTIONS = ['pendiente', 'pagado', 'cancelado'];

    tbody.innerHTML = orders.map(o => {
    const date       = new Date(o.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const time       = new Date(o.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const delivIcon  = o.deliveryType === 'recojo' ? '🏪' : '📦';
    const delivText  = o.deliveryType === 'recojo' ? 'Recojo' : 'Shalom';
    const safeStatus = o.status.replace(/[^a-z]/g, '');
    const selectVal  = SELECT_OPTIONS.includes(o.status) ? o.status : 'pendiente';

    const itemsHtml = (o.items || []).map(i =>
      `<div class="order-item-line">
        <span class="order-item-name">${sanitize((i.brand||'') + (i.brand && i.productName ? ' ' : '') + (i.productName||''))}</span>
        <span class="order-item-size-chip">${sanitize(i.size||'')} ×${parseInt(i.quantity)||1}</span>
      </div>`
    ).join('');

    const _PAY_BADGE_MAP = {
      efectivo:      '<span class="pay-badge pay-efectivo">💵 Efectivo</span>',
      yape:          '<span class="pay-badge pay-yape">📱 Yape</span>',
      plin:          '<span class="pay-badge pay-plin">📲 Plin</span>',
      transferencia: '<span class="pay-badge pay-transferencia">🏦 Transferencia</span>'
    };
    const payBadge = o.paymentMethod && _PAY_BADGE_MAP[o.paymentMethod]
      ? `<div style="margin-top:.3rem">${_PAY_BADGE_MAP[o.paymentMethod]}</div>`
      : '';

    return `
    <tr class="order-row">
      <td class="order-col-id">
        <span class="order-id">${sanitize(o.id)}</span>
        <div class="order-date" style="margin-top:.2rem">${date} · ${time}</div>
        <div class="order-date">${delivIcon} ${delivText}</div>
      </td>
      <td class="order-col-client">
        <span class="order-customer">${sanitize(o.customerName || '—')}</span>
        ${o.customerPhone ? `<div class="order-date">${sanitize(o.customerPhone)}</div>` : ''}
        ${o.customerDni   ? `<div class="order-date" style="font-size:.68rem">DNI ${sanitize(o.customerDni)}</div>` : ''}
      </td>
      <td class="order-col-items">
        <div class="order-items-list">${itemsHtml}</div>
      </td>
      <td class="order-col-total">
        <span class="order-total-cell">S/ ${o.total.toFixed(2)}</span>
      </td>
      <td class="order-col-status">
        <span class="status-badge status-${safeStatus}">${STATUS_LABELS[o.status] ?? sanitize(o.status)}</span>
        ${payBadge}
      </td>
      <td class="order-col-actions">
        <div class="order-actions-stack">
          <select class="order-action-select" data-id="${escapeAttr(o.id)}" data-status="${escapeAttr(o.status)}" aria-label="Cambiar estado">
            ${SELECT_OPTIONS.map(s =>
              `<option value="${s}" ${selectVal === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`
            ).join('')}
          </select>
          <div class="order-btn-row">
            <button class="btn-order-detail" data-id="${escapeAttr(o.id)}">Ver</button>
            <button class="btn-edit-order"   data-id="${escapeAttr(o.id)}">Editar</button>
            <button class="btn-delete-order" data-id="${escapeAttr(o.id)}" title="Eliminar pedido">✕</button>
          </div>
        </div>
      </td>
    </tr>`;
    }).join('');

    // Cambio de estado
    tbody.querySelectorAll('.order-action-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const id        = sel.dataset.id;
        const newStatus = sel.value;
        const prevStatus = sel.dataset.status;

        const doUpdate = async (paymentMethod = null) => {
          try {
            await CloudOrders.updateStatus(id, newStatus, paymentMethod);
            sel.dataset.status = newStatus;
            _statsCache = null;
            renderOrdersSection().catch(console.error);
            const _payLabels = { efectivo: '💵 Efectivo', yape: '📱 Yape', plin: '📲 Plin', transferencia: '🏦 Transferencia' };
            const payLabel = paymentMethod && _payLabels[paymentMethod] ? ` · ${_payLabels[paymentMethod]}` : '';
            showToast(`Pedido ${id} → ${STATUS_LABELS[newStatus]}${payLabel}`);
          } catch (err) {
            console.error('Error al actualizar estado:', err);
            sel.value = prevStatus;
            showToast('Error al actualizar el pedido. Inténtalo de nuevo.');
          }
        };

        if (newStatus === 'pagado') {
          sel.value = prevStatus;
          CloudOrders.getById(id).then(order => {
            const items   = order?.items || [];
            const mlLines = items
              .filter(i => parseInt(i.size) > 0)
              .map(i => `  • ${i.productName} ${i.size} ×${i.quantity} = ${parseInt(i.size) * i.quantity} ml`)
              .join('\n');
            const info = mlLines ? `Stock a descontar:\n${mlLines}\n\n` : '';
            showPaymentModal(
              `${info}¿Cómo pagó el pedido ${id}?`,
              (payMethod) => { sel.value = newStatus; doUpdate(payMethod); },
              () => { sel.value = prevStatus; }
            );
          }).catch(() => {
            showPaymentModal(
              `¿Cómo pagó el pedido ${id}?`,
              (payMethod) => { sel.value = newStatus; doUpdate(payMethod); },
              () => { sel.value = prevStatus; }
            );
          });
        } else {
          doUpdate();
        }
      });
    });

    // Ver detalle
    tbody.querySelectorAll('.btn-order-detail').forEach(btn => {
      btn.addEventListener('click', () => openOrderDetail(btn.dataset.id).catch(console.error));
    });

    // Editar pedido
    tbody.querySelectorAll('.btn-edit-order').forEach(btn => {
      btn.addEventListener('click', () => openEditOrderModal(btn.dataset.id).catch(console.error));
    });

    // Eliminar pedido
    tbody.querySelectorAll('.btn-delete-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        showConfirmModal(
          `¿Eliminar el pedido ${id}? Esta acción no se puede deshacer.`,
          async () => {
            try {
              await CloudOrders.delete(id);
              renderOrdersSection().catch(console.error);
              showToast(`Pedido ${id} eliminado.`);
            } catch (err) {
              console.error(err);
              showToast('Error al eliminar el pedido.');
            }
          },
          () => {}
        );
      });
    });
  } catch (err) {
    console.error('[MICHT] renderOrdersSection falló:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem">No se pudieron cargar los pedidos.</td></tr>';
  }
}

async function openOrderDetail(id) {
  const order = await CloudOrders.getById(id);
  if (!order) return;
  const modal = document.getElementById('orderDetailModal');
  const body  = document.getElementById('orderDetailBody');

  const STATUS_LABELS = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };
  const date = new Date(order.date).toLocaleString('es-PE');

  body.innerHTML = `
    <div class="order-detail-row"><span class="lbl">ID Pedido</span><span class="val order-id">${order.id}</span></div>
    <div class="order-detail-row"><span class="lbl">Estado</span><span class="val"><span class="status-badge status-${order.status}">${STATUS_LABELS[order.status]}</span></span></div>
    <div class="order-detail-row">
      <span class="lbl">Método pago</span>
      <span class="val" style="display:flex;align-items:center;gap:.5rem">
        <select id="detPayMethod" style="padding:.3rem .6rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.82rem">
          <option value=""              ${!order.paymentMethod                         ?'selected':''}>⏳ Por confirmar</option>
          <option value="yape"          ${order.paymentMethod==='yape'          ?'selected':''}>📱 Yape</option>
          <option value="plin"          ${order.paymentMethod==='plin'          ?'selected':''}>📲 Plin</option>
          <option value="efectivo"      ${order.paymentMethod==='efectivo'      ?'selected':''}>💵 Efectivo</option>
          <option value="transferencia" ${order.paymentMethod==='transferencia' ?'selected':''}>🏦 Transferencia</option>
        </select>
        <button id="savePayMethodBtn" style="font-size:.75rem;padding:.3rem .75rem;background:var(--gold);color:#111;border:none;border-radius:var(--r);font-weight:700;cursor:pointer">Guardar</button>
      </span>
    </div>
    <div class="order-detail-row"><span class="lbl">Fecha</span><span class="val">${date}</span></div>
    <hr style="border-color:var(--border)">
    <div class="order-detail-row"><span class="lbl">Cliente</span><span class="val">${sanitize(order.customerName || '—')}</span></div>
    <div class="order-detail-row"><span class="lbl">DNI</span><span class="val">${sanitize(order.customerDni || '—')}</span></div>
    <div class="order-detail-row"><span class="lbl">Teléfono</span><span class="val">${sanitize(order.customerPhone || '—')}</span></div>
    <hr style="border-color:var(--border)">
    <div class="order-detail-row"><span class="lbl">Entrega</span><span class="val">${order.deliveryType === 'recojo' ? '🏪 Recojo en tienda' : '📦 Envío Shalom'}</span></div>
    ${order.deliveryType === 'envio' ? `
    <div class="order-detail-row"><span class="lbl">Dpto / Prov</span><span class="val">${sanitize(order.department || '')} / ${sanitize(order.province || '')}</span></div>
    <div class="order-detail-row"><span class="lbl">Agencia Shalom</span><span class="val">${sanitize(order.shalomOffice || '—')}</span></div>
    ` : ''}
    <hr style="border-color:var(--border)">
    <strong style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em">Productos</strong>
    <ul style="margin-top:.5rem;display:flex;flex-direction:column;gap:.4rem">
      ${order.items.map(i => `
      <li style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text2)">
        <span>${sanitize(i.brand || '')} ${sanitize(i.productName)} <span class="decant-chip">${sanitize(i.size)}</span> ×${i.quantity}</span>
        <strong style="color:var(--gold)">S/ ${(i.price * i.quantity).toFixed(2)}</strong>
      </li>`).join('')}
    </ul>
    <div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border-l)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
        <strong style="color:var(--text)">Total del pedido</strong>
        <strong style="color:var(--gold);font-size:1.05rem" id="orderDetailTotalDisplay">S/ ${order.total.toFixed(2)}</strong>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <label style="font-size:.75rem;color:var(--text2);white-space:nowrap">Modificar total:</label>
        <div style="display:flex;gap:.4rem;flex:1">
          <div style="position:relative;flex:1">
            <span style="position:absolute;left:.6rem;top:50%;transform:translateY(-50%);color:var(--text2);font-size:.82rem;pointer-events:none">S/</span>
            <input type="number" id="orderTotalInput" value="${order.total.toFixed(2)}"
              min="0" max="99999" step="0.01"
              style="width:100%;padding:.4rem .4rem .4rem 1.8rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-size:.85rem;box-sizing:border-box">
          </div>
          <button id="saveOrderTotalBtn" data-id="${escapeAttr(order.id)}"
            style="padding:.4rem .9rem;background:var(--gold);color:#111;border:none;border-radius:var(--r);font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s"
            onmouseover="this.style.background='#e0c050'" onmouseout="this.style.background='var(--gold)'">
            Guardar
          </button>
        </div>
      </div>
      <p style="font-size:.7rem;color:var(--text3);margin:.4rem 0 0">Solo afecta la contabilidad, no cambia los precios de los productos.</p>
    </div>
    ${order.notes ? `<div class="order-detail-row" style="margin-top:.5rem"><span class="lbl">Notas cliente</span><span class="val">${sanitize(order.notes)}</span></div>` : ''}
    <hr style="border-color:var(--border)">
    <div>
      <label style="font-size:.74rem;color:var(--text2);font-weight:600;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:.4rem">📌 Notas internas (solo tú las ves)</label>
      <textarea id="adminNoteInput" rows="2" maxlength="400"
        style="width:100%;padding:.5rem .75rem;background:var(--bg);border:1px solid rgba(201,168,76,.3);border-radius:var(--r);color:var(--text);font-size:.82rem;resize:vertical;box-sizing:border-box;font-family:Inter,sans-serif;line-height:1.4;outline:none;transition:border-color .2s"
        onfocus="this.style.borderColor='var(--gold-d)'" onblur="this.style.borderColor='rgba(201,168,76,.3)'"
        placeholder="Ej: Falta pagar el saldo, cliente frecuente, etc.">${getAdminNote(order.id)}</textarea>
      <button id="saveAdminNoteBtn" data-id="${escapeAttr(order.id)}"
        style="margin-top:.4rem;padding:.35rem .9rem;background:rgba(201,168,76,.12);color:var(--gold-d);border:1px solid rgba(201,168,76,.3);border-radius:var(--r);font-size:.75rem;font-weight:700;cursor:pointer;transition:background .15s"
        onmouseover="this.style.background='rgba(201,168,76,.22)'" onmouseout="this.style.background='rgba(201,168,76,.12)'">
        Guardar nota
      </button>
    </div>
    ${order.deliveryType === 'envio' ? `
    <button id="openShippingLabelBtn" data-id="${escapeAttr(order.id)}"
      style="margin-top:.25rem;width:100%;padding:.55rem;background:rgba(33,150,243,.1);color:#64b5f6;border:1px solid rgba(33,150,243,.25);border-radius:var(--r);font-size:.82rem;font-weight:700;cursor:pointer;transition:background .15s"
      onmouseover="this.style.background='rgba(33,150,243,.18)'" onmouseout="this.style.background='rgba(33,150,243,.1)'">
      🖨 Imprimir etiqueta de envío
    </button>` : ''}
  `;

  // Guardar método de pago
  body.querySelector('#savePayMethodBtn')?.addEventListener('click', async () => {
    const pm  = body.querySelector('#detPayMethod')?.value || null;
    const btn = body.querySelector('#savePayMethodBtn');
    btn.disabled = true; btn.textContent = '…';
    try {
      await CloudOrders.update(order.id, { paymentMethod: pm });
      _statsCache = null;
      const label = pm === 'efectivo' ? '💵 Efectivo' : pm === 'yape' ? '📱 Yape' : 'Por confirmar';
      showToast(`Método de pago actualizado: ${label} ✓`);
      renderOrdersSection().catch(console.error);
    } catch(e) { showToast('Error al guardar.'); }
    btn.disabled = false; btn.textContent = 'Guardar';
  });

  // Guardar nuevo total
  body.querySelector('#saveOrderTotalBtn')?.addEventListener('click', async () => {
    const btn   = body.querySelector('#saveOrderTotalBtn');
    const input = body.querySelector('#orderTotalInput');
    const newTotal = parseFloat(input.value);

    if (isNaN(newTotal) || newTotal < 0) {
      showToast('Ingresa un total válido mayor a 0.');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Guardando…';

    try {
      // Actualizar en Supabase
      if (db) {
        const { error } = await db
          .from('pedidos')
          .update({ total: newTotal, updated_at: new Date().toISOString() })
          .eq('id', order.id);
        if (error) throw error;
      }
      // Actualizar en localStorage
      const local = Orders.getAll();
      const idx   = local.findIndex(o => o.id === order.id);
      if (idx !== -1) { local[idx].total = newTotal; Orders.save(local); }

      // Actualizar el display en el modal
      const display = body.querySelector('#orderDetailTotalDisplay');
      if (display) display.textContent = `S/ ${newTotal.toFixed(2)}`;

      showToast(`Total del pedido ${order.id} actualizado a S/ ${newTotal.toFixed(2)} ✓`);
      // Refrescar tabla de pedidos en fondo
      renderOrdersSection().catch(console.error);
    } catch (err) {
      console.error('Error al actualizar total:', err);
      showToast('Error al guardar. Intenta de nuevo.');
    }

    btn.disabled    = false;
    btn.textContent = 'Guardar';
  });

  // Guardar nota interna
  body.querySelector('#saveAdminNoteBtn')?.addEventListener('click', async () => {
    const note = body.querySelector('#adminNoteInput')?.value.trim() || '';
    const btn  = body.querySelector('#saveAdminNoteBtn');
    btn.disabled = true; btn.textContent = 'Guardando…';
    await saveAdminNote(order.id, note);
    showToast('Nota interna guardada ✓');
    btn.disabled = false; btn.textContent = 'Guardar nota';
  });

  // Abrir etiqueta de envío
  body.querySelector('#openShippingLabelBtn')?.addEventListener('click', () => {
    openShippingLabel(order.id).catch(console.error);
  });

  modal.classList.add('open');
}

function setupOrderEvents() {
  // Buscador de pedidos
  document.getElementById('orderSearch')?.addEventListener('input', function() {
    _orderSearch = this.value.trim();
    renderOrdersSection().catch(console.error);
  });

  // Filtros de estado
  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      orderStatusFilter = btn.dataset.status;
      renderOrdersSection().catch(console.error);
    });
  });

  // Actualizar pedidos
  document.getElementById('refreshOrdersBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshOrdersBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
    await renderOrdersSection().catch(console.error);
    await updateOrderStats().catch(console.error);
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    showToast('Pedidos actualizados ✓');
  });

  // Registrar pedido manual
  document.getElementById('registerOrderBtn')?.addEventListener('click', openRegisterOrderModal);

  // Cerrar modal de detalle
  document.getElementById('closeOrderModal')?.addEventListener('click', () => {
    document.getElementById('orderDetailModal').classList.remove('open');
  });

  // Guardar pedido manual
  document.getElementById('saveOrderBtn')?.addEventListener('click', () => saveManualOrder().catch(console.error));
  document.getElementById('cancelOrderModal')?.addEventListener('click', () => {
    document.getElementById('registerOrderModal').classList.remove('open');
  });

  // Añadir línea de producto al pedido manual
  document.getElementById('addOrderItemBtn')?.addEventListener('click', addOrderItemRow);
}

async function openRegisterOrderModal() {
  document.getElementById('regCustomerName').value  = '';
  document.getElementById('regCustomerPhone').value = '';
  document.getElementById('regCustomerDni').value   = '';
  document.getElementById('regDeliveryType').value  = 'recojo';
  document.getElementById('regNotes').value         = '';
  document.getElementById('regOrderItems').innerHTML = '';
  addOrderItemRow();
  document.getElementById('registerOrderModal').classList.add('open');

  // Cargar historial de clientes para autocomplete
  try {
    const orders = await CloudOrders.getAll();
    const seen = new Set();
    _customerHistory = [];
    orders.forEach(o => {
      if (!o.customerName) return;
      const key = (o.customerName + '|' + (o.customerPhone || '')).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        _customerHistory.push({ name: o.customerName, phone: o.customerPhone || '', dni: o.customerDni || '' });
      }
    });
  } catch(e) { _customerHistory = []; }

  _setupCustomerAutocomplete();
}

function _setupCustomerAutocomplete() {
  const input = document.getElementById('regCustomerName');
  if (!input) return;

  // Contenedor del autocomplete
  let dropdown = document.getElementById('custAutocomplete');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'custAutocomplete';
    dropdown.className = 'cust-autocomplete-dropdown';
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(dropdown);
  }
  dropdown.innerHTML = '';
  dropdown.style.display = 'none';

  function renderCustDropdown(query) {
    const q = query.toLowerCase().trim();
    if (!q) { dropdown.style.display = 'none'; return; }
    const matches = _customerHistory
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 7);
    if (!matches.length) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map((c, i) => `
      <div class="cust-opt" data-name="${escapeAttr(c.name)}" data-phone="${escapeAttr(c.phone)}" data-dni="${escapeAttr(c.dni)}">
        <div class="cust-opt-name">${c.name}</div>
        <div class="cust-opt-meta">${c.phone ? '📞 ' + c.phone : ''}${c.dni ? ' · DNI ' + c.dni : ''}</div>
      </div>`).join('');

    dropdown.querySelectorAll('.cust-opt').forEach(opt => {
      const selectCust = e => {
        e.preventDefault();
        const nameEl  = document.getElementById('regCustomerName');
        const phoneEl = document.getElementById('regCustomerPhone');
        const dniEl   = document.getElementById('regCustomerDni');
        if (nameEl)  nameEl.value  = opt.dataset.name;
        if (opt.dataset.phone && phoneEl) phoneEl.value = opt.dataset.phone;
        if (opt.dataset.dni   && dniEl)   dniEl.value   = opt.dataset.dni;
        dropdown.style.display = 'none';
        showToast('✓ Datos del cliente cargados automáticamente');
      };
      opt.addEventListener('mousedown', selectCust);
      opt.addEventListener('touchstart', selectCust, { passive: false });
    });
    dropdown.style.display = 'block';
  }

  // Re-registrar listeners clonando el input para limpiar anteriores
  const fresh = input.cloneNode(true);
  input.parentNode.replaceChild(fresh, input);
  const nameInput = document.getElementById('regCustomerName');

  nameInput.addEventListener('input',  () => renderCustDropdown(nameInput.value));
  nameInput.addEventListener('focus',  () => renderCustDropdown(nameInput.value));
  nameInput.addEventListener('blur',   () => setTimeout(() => { dropdown.style.display = 'none'; }, 200));
  nameInput.addEventListener('keydown', e => {
    const items = [...dropdown.querySelectorAll('.cust-opt')];
    const cur = dropdown.querySelector('.cust-opt.focused');
    const idx = cur ? items.indexOf(cur) : -1;
    if (e.key === 'ArrowDown') { e.preventDefault(); cur?.classList.remove('focused'); items[Math.min(idx + 1, items.length - 1)]?.classList.add('focused'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur?.classList.remove('focused'); items[Math.max(idx - 1, 0)]?.classList.add('focused'); }
    else if (e.key === 'Enter' && cur) { e.preventDefault(); cur.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }
    else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
  });
}

function addOrderItemRow() {
  const container = document.getElementById('regOrderItems');
  const products  = Products.getAll();

  // ── Construir lista completa de opciones (producto + talla) ────────────────
  // Orden: 1) Enteros (tipo entero), 2) Decants disponibles como entero, 3) Decants normales
  const enteroProds  = products.filter(p => p.type === 'entero');
  const decantProds  = products.filter(p => p.type !== 'entero');

  const allOptions = [];

  // Perfumes Enteros (tipo entero)
  enteroProds.forEach(p => {
    Object.entries(p.sizes).forEach(([sizeLabel, price]) => {
      const priceStr = price > 0 ? `S/${price}` : 'Consultar';
      allOptions.push({
        value: `${p.id}|${sizeLabel}|${price}|${p.name}|${p.brand}`,
        label: `🛍 ENTERO · ${p.brand} – ${p.name} (${sizeLabel}) ${priceStr}`
      });
    });
  });

  // Decants habilitados como entero (opción extra Unidad)
  decantProds.filter(p => p.availableAsEntero && (p.enteroPrice || 0) > 0).forEach(p => {
    allOptions.push({
      value: `${p.id}|Unidad|${p.enteroPrice}|${p.name}|${p.brand}`,
      label: `🛍 ENTERO · ${p.brand} – ${p.name} (Unidad) S/${p.enteroPrice}`
    });
  });

  // Decants normales (todos sus ml)
  decantProds.forEach(p => {
    Object.entries(p.sizes).forEach(([ml, price]) => {
      const priceStr = price > 0 ? `S/${price}` : 'Consultar';
      allOptions.push({
        value: `${p.id}|${ml}|${price}|${p.name}|${p.brand}`,
        label: `💧 Decant · ${p.brand} – ${p.name} (${ml}) ${priceStr}`
      });
    });
  });

  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.style.cssText = 'display:flex;gap:.5rem;align-items:flex-start;margin-bottom:.6rem;flex-wrap:wrap';
  row.innerHTML = `
    <div style="flex:2;min-width:200px;position:relative">
      <input type="text" class="order-product-search order-action-select"
             placeholder="Escribe para buscar perfume..."
             autocomplete="off"
             style="width:100%;padding:.38rem .6rem;font-size:.82rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r)">
      <div class="product-search-dropdown"
           style="display:none;position:absolute;top:calc(100% + 2px);left:0;right:0;background:var(--card);border:1px solid var(--border-l);border-radius:var(--r);z-index:200;max-height:220px;overflow-y:auto;box-shadow:var(--sh)">
      </div>
      <input type="hidden" class="order-product-value">
    </div>
    <input type="number" class="order-qty-input" min="1" max="99" value="1"
           style="width:62px;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:.38rem .5rem;border-radius:var(--r);font-size:.82rem">
    <button type="button" class="remove-size-btn" style="flex-shrink:0;margin-top:2px" onclick="this.closest('.order-item-row').remove()">×</button>
  `;

  const searchInput   = row.querySelector('.order-product-search');
  const dropdown      = row.querySelector('.product-search-dropdown');
  const hiddenInput   = row.querySelector('.order-product-value');

  function renderDropdown(filter) {
    const q = filter.toLowerCase().trim();
    const matches = q
      ? allOptions.filter(o => o.label.toLowerCase().includes(q)).slice(0, 25)
      : allOptions.slice(0, 25);

    if (!matches.length) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map(o =>
      `<div class="prod-opt" data-value="${escapeAttr(o.value)}" data-label="${escapeAttr(o.label)}"
            style="padding:.42rem .75rem;cursor:pointer;font-size:.82rem;color:var(--text2);border-bottom:1px solid var(--border);transition:background .12s"
            onmouseenter="this.style.background='var(--gold-dim)';this.style.color='var(--text)'"
            onmouseleave="this.style.background='';this.style.color='var(--text2)'">${o.label}</div>`
    ).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.prod-opt').forEach(opt => {
      const selectProd = e => {
        e.preventDefault();
        hiddenInput.value  = opt.dataset.value;
        searchInput.value  = opt.dataset.label;
        dropdown.style.display = 'none';
      };
      opt.addEventListener('mousedown', selectProd);
      opt.addEventListener('touchstart', selectProd, { passive: false });
    });
  }

  searchInput.addEventListener('input',  () => renderDropdown(searchInput.value));
  searchInput.addEventListener('focus',  () => renderDropdown(searchInput.value));
  searchInput.addEventListener('blur',   () => setTimeout(() => { dropdown.style.display = 'none'; }, 250));

  container.appendChild(row);
  // No forzar foco en móvil — abre teclado virtual automáticamente y causa saltos de scroll
  if (!('ontouchstart' in window)) searchInput.focus();
}

async function saveManualOrder() {
  const name  = document.getElementById('regCustomerName').value.trim();
  const phone = document.getElementById('regCustomerPhone').value.trim();
  const dni   = document.getElementById('regCustomerDni').value.trim();
  const dtype    = document.getElementById('regDeliveryType').value;
  const payMeth  = document.getElementById('regPaymentMethod')?.value || '';
  const initStat = document.getElementById('regOrderStatus')?.value || 'pendiente';
  const notes    = document.getElementById('regNotes').value.trim();

  if (!name) { alert('Ingresa el nombre del cliente.'); return; }

  const items = [];
  document.querySelectorAll('.order-item-row').forEach(row => {
    const val = row.querySelector('.order-product-value')?.value;
    const qty = parseInt(row.querySelector('.order-qty-input').value) || 1;
    if (!val) return;
    const parts = val.split('|');
    const [pid, size, price, pName, pBrand] = parts;
    if (!pid || !size) return;
    items.push({
      productId:   parseInt(pid),
      brand:       pBrand || '',
      productName: pName  || '',
      size,
      price:       parseFloat(price),
      quantity:    qty
    });
  });

  if (!items.length) { alert('Agrega al menos un producto al pedido.'); return; }

  // Cargar productos frescos desde Supabase para validación y descuento correcto
  const saveBtn = document.getElementById('saveOrderBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Verificando stock...'; }

  let prodLookup = {};
  try {
    const allProds = await CloudProducts.getAll();
    allProds.forEach(p => { prodLookup[p.id] = p; });
  } catch (_) {
    Products.getAll().forEach(p => { prodLookup[p.id] = p; });
  }

  // Validar stock con datos frescos de Supabase
  const stockErrors = [];
  items.forEach(item => {
    const product = prodLookup[item.productId];
    if (!product) return;
    if (!product.inStock) {
      stockErrors.push(`${item.brand} – ${item.productName}: AGOTADO`);
    } else if (product.type === 'entero' && typeof product.stockQuantity === 'number') {
      if (item.quantity > product.stockQuantity) {
        stockErrors.push(`${item.brand} – ${item.productName}: solo quedan ${product.stockQuantity} unidad(es)`);
      }
    }
  });
  if (stockErrors.length) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar Pedido'; }
    alert('⚠ Stock insuficiente:\n\n' + stockErrors.join('\n') + '\n\nAjusta las cantidades antes de guardar.');
    return;
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  if (saveBtn) saveBtn.textContent = 'Guardando...';

  try {
    // Siempre crear como 'pendiente' primero para que updateStatus pueda detectar el cambio
    // de estado y descontar el stock una sola vez (evita doble deducción)
    const orderId = await CloudOrders.create({ customerName: name, customerPhone: phone, customerDni: dni, deliveryType: dtype, notes, items, total, paymentMethod: payMeth || null, status: 'pendiente' });

    // Si el admin registra el pedido directo como 'pagado', aplicar el descuento de stock
    // vía updateStatus (que también cambia el estado a 'pagado')
    if (initStat === 'pagado') {
      await CloudOrders.updateStatus(orderId, 'pagado', payMeth || null);
    }

    // Cerrar modal y mostrar éxito inmediatamente — el refresh es no-bloqueante
    document.getElementById('registerOrderModal').classList.remove('open');
    showToast('Pedido registrado correctamente ✓');
    renderOrdersSection().catch(console.error);
    renderAdminProducts().catch(console.error);

  } catch (err) {
    console.error('[MICHT] Error guardando pedido:', err);
    showToast('Error al guardar el pedido. Inténtalo de nuevo.');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar Pedido'; }
  }
}

// ─── Subida de imagen ────────────────────────────────────────────────────────

function updateImgPreview(url) {
  const preview     = document.getElementById('imgPreview');
  const placeholder = document.getElementById('imgPlaceholder');
  const zone        = document.getElementById('imgUploadZone');
  const actions     = document.getElementById('imgUploadActions');
  if (url) {
    preview.src          = url;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    zone.classList.add('has-image');
    actions.style.display = 'flex';
  } else {
    preview.src          = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    zone.classList.remove('has-image');
    actions.style.display = 'none';
  }
}

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Selecciona una imagen válida (JPG, PNG o WebP).'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('La imagen supera los 5 MB.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('editImageUrl').value = e.target.result;
    updateImgPreview(e.target.result);
  };
  reader.readAsDataURL(file);
}

// ─── Modal de producto (crear/editar) ────────────────────────────────────────

function openProductModal(id = null) {
  const modal   = document.getElementById('productModal');
  const product = id ? Products.getById(id) : null;
  document.getElementById('modalProductTitle').textContent = product ? 'Editar Perfume' : 'Agregar Perfume';

  document.getElementById('editId').value          = product?.id ?? '';
  document.getElementById('editName').value        = product?.name ?? '';
  document.getElementById('editBrand').value       = product?.brand ?? '';
  document.getElementById('editType').value        = product?.type ?? 'diseñador';
  document.getElementById('editGender').value      = product?.gender ?? 'unisex';
  document.getElementById('editOccasion').value    = product?.occasion ?? 'ambas';
  document.getElementById('editOlfFamily').value   = product?.olfFamily ?? '';
  document.getElementById('editTopNotes').value    = product?.topNotes ?? '';
  document.getElementById('editHeartNotes').value  = product?.heartNotes ?? '';
  document.getElementById('editBaseNotes').value   = product?.baseNotes ?? '';
  document.getElementById('editDescription').value   = product?.description ?? '';
  document.getElementById('editContentDesc').value   = product?.contentDescription ?? '';
  const imageUrl = product?.imageUrl ?? '';
  document.getElementById('editImageUrl').value = imageUrl;
  updateImgPreview(imageUrl);
  document.getElementById('imgFileInput').value = '';

  const sizesContainer = document.getElementById('sizesContainer');
  const sizes = product?.sizes ?? { '5ml': 0, '10ml': 0 };
  sizesContainer.innerHTML = '';
  Object.entries(sizes).forEach(([ml, price]) => addSizeRow(ml, price));

  modal.classList.add('open');
}

function addSizeRow(ml = '', price = '') {
  const container = document.getElementById('sizesContainer');
  const row = document.createElement('div');
  row.className = 'size-row';
  row.innerHTML = `
    <input type="text"   class="size-ml"    placeholder="Ej: 10ml" value="${escapeAttr(String(ml))}" maxlength="10">
    <input type="number" class="size-price" placeholder="Precio S/" value="${price}" min="0" max="9999" step="0.5">
    <button type="button" class="remove-size-btn">×</button>
  `;
  row.querySelector('.remove-size-btn')?.addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function setupAdminEvents() {
  document.getElementById('adminProductSearch')?.addEventListener('input', function() {
    _adminProductSearch = this.value.trim();
    _adminPage = 1;
    renderAdminProducts().catch(console.error);
  });

  document.querySelectorAll('.admin-type-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      _adminProductTypeFilter = btn.dataset.type;
      _adminPage = 1;
      document.querySelectorAll('.admin-type-filter').forEach(b => {
        const active = b === btn;
        b.style.background = active ? 'var(--gold)' : 'var(--bg2)';
        b.style.color       = active ? '#111' : 'var(--text2)';
        b.style.borderColor = active ? 'var(--gold)' : 'var(--border)';
        b.classList.toggle('active', active);
      });
      renderAdminProducts().catch(console.error);
    });
  });

  document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());

  document.getElementById('refreshInventoryBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshInventoryBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
    await renderInventorySection().catch(console.error);
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  });

  document.getElementById('closeProductModal')?.addEventListener('click', () => {
    document.getElementById('productModal')?.classList.remove('open');
  });
  document.getElementById('cancelProductModal')?.addEventListener('click', () => {
    document.getElementById('productModal')?.classList.remove('open');
  });

  document.getElementById('addSizeBtn')?.addEventListener('click', () => addSizeRow());

  document.getElementById('saveProductBtn')?.addEventListener('click', async () => {
    const id          = document.getElementById('editId').value;
    const name        = document.getElementById('editName').value.trim();
    const brand       = document.getElementById('editBrand').value.trim();
    const type        = document.getElementById('editType').value;
    const gender      = document.getElementById('editGender').value;
    const occasion    = document.getElementById('editOccasion').value;
    const olfFamily   = document.getElementById('editOlfFamily').value.trim();
    const topNotes    = document.getElementById('editTopNotes').value.trim();
    const heartNotes  = document.getElementById('editHeartNotes').value.trim();
    const baseNotes   = document.getElementById('editBaseNotes').value.trim();
    const description    = document.getElementById('editDescription').value.trim();
    const contentDescription = document.getElementById('editContentDesc').value.trim();
    const imageUrl       = document.getElementById('editImageUrl').value.trim();

    if (!name || !brand) { alert('Nombre y marca son obligatorios.'); return; }

    // Validar URL de imagen: solo http/https/data (bloquea javascript: y otros)
    if (imageUrl) {
      const allowedProtocols = /^(https?:|data:image\/)/i;
      if (!allowedProtocols.test(imageUrl)) {
        alert('URL de imagen inválida. Usa solo HTTP, HTTPS o imágenes en base64.');
        return;
      }
      if (imageUrl.length > 5000) {
        alert('URL de imagen demasiado larga.');
        return;
      }
    }

    const sizes = {};
    document.querySelectorAll('.size-row').forEach(row => {
      const ml    = row.querySelector('.size-ml').value.trim();
      const price = parseFloat(row.querySelector('.size-price').value);
      if (ml && !isNaN(price) && price >= 0) sizes[ml] = price;
    });
    if (!Object.keys(sizes).length) { alert('Agrega al menos una talla.'); return; }

    const data = { name, brand, type, gender, occasion, olfFamily, topNotes, heartNotes, baseNotes, description, contentDescription, imageUrl, sizes, inStock: true, bottleRemainingMl: 0, bottleTotalMl: 0, featured: false };

    const saveBtn = document.getElementById('saveProductBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
    try {
      if (id) { await CloudProducts.update(parseInt(id), data); }
      else    { await CloudProducts.add(data); }
      document.getElementById('productModal').classList.remove('open');
      renderAdminProducts().catch(console.error);
      showToast(id ? 'Perfume actualizado ✓' : 'Perfume agregado ✓');
    } catch (err) {
      console.error(err);
      showToast('Error al guardar. Inténtalo de nuevo.');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Guardar';
    }
  });

  // ── Subida de imagen ────────────────────────────────────────────────────────
  const imgZone   = document.getElementById('imgUploadZone');
  const imgInput  = document.getElementById('imgFileInput');
  const imgChange = document.getElementById('imgChangeBtn');
  const imgRemove = document.getElementById('imgRemoveBtn');

  imgZone?.addEventListener('click', () => imgInput?.click());
  imgZone?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') imgInput?.click(); });
  imgInput?.addEventListener('change', () => { if (imgInput.files[0]) handleImageFile(imgInput.files[0]); });

  imgZone?.addEventListener('dragover', e => { e.preventDefault(); imgZone.classList.add('drag-over'); });
  imgZone?.addEventListener('dragleave', () => imgZone.classList.remove('drag-over'));
  imgZone?.addEventListener('drop', e => {
    e.preventDefault();
    imgZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
  });

  imgChange?.addEventListener('click', e => { e.stopPropagation(); imgInput.click(); });
  imgRemove?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('editImageUrl').value = '';
    updateImgPreview('');
    imgInput.value = '';
  });

  // Cambiar contraseña (usa Supabase Auth)
  document.getElementById('changePassForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw1  = document.getElementById('adminNewPassword').value;
    const pw2  = document.getElementById('adminConfirmPassword').value;
    const msg  = document.getElementById('passChangeMsg');
    if (pw1.length < 8) { msg.textContent = 'Mínimo 8 caracteres.'; msg.className = 'msg-error'; msg.style.display = 'block'; return; }
    if (pw1 !== pw2)    { msg.textContent = 'Las contraseñas no coinciden.'; msg.className = 'msg-error'; msg.style.display = 'block'; return; }
    const { error } = await db.auth.updateUser({ password: pw1 });
    if (error) {
      msg.textContent = 'Error al cambiar contraseña: ' + error.message;
      msg.className = 'msg-error';
    } else {
      msg.textContent = '¡Contraseña cambiada correctamente!';
      msg.className = 'msg-success';
    }
    msg.style.display = 'block';
    e.target.reset();
  });

  setupCampaignEvents();
}

async function refreshCampaignAdminUI() {
  const statusEl = document.getElementById('campaignStatusText');
  if (!statusEl || typeof SiteTheme === 'undefined') return;

  const updatedAtEl = document.getElementById('campaignUpdatedAt');
  const autoBtn = document.getElementById('autoCampaignBtn');
  const settings = await SiteTheme.getSettings();
  const activeCampaign = settings.campaign || 'default';
  const mode = settings.mode === 'auto' ? 'auto' : 'manual';
  const modeLabel = mode === 'auto' ? 'Automático' : 'Manual';
  statusEl.textContent = `${CAMPAIGN_LABELS[activeCampaign] || 'Diseño normal'} · ${modeLabel}`;

  const statusBox = document.querySelector('.campaign-status-box');
  if (statusBox) {
    statusBox.className = 'campaign-status-box campaign-' + activeCampaign;
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(statusBox, 
        { scale: 0.97, opacity: 0.85 }, 
        { scale: 1, opacity: 1, duration: 0.45, ease: 'power2.out' }
      );
    }
  }

  if (autoBtn) {
    autoBtn.classList.toggle('active', mode === 'auto');
    autoBtn.textContent = mode === 'auto' ? 'Modo automático activo' : 'Modo automático';
  }

  if (updatedAtEl) {
    if (settings.updatedAt) {
      const d = new Date(settings.updatedAt);
      updatedAtEl.textContent = `Última actualización: ${d.toLocaleString('es-PE')} · Campaña del día: ${CAMPAIGN_LABELS[activeCampaign] || 'Diseño normal'}`;
    } else {
      updatedAtEl.textContent = 'Última actualización: no registrada';
    }
  }

  document.querySelectorAll('.campaign-apply-btn').forEach(btn => {
    const isActive = btn.dataset.campaign === activeCampaign;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function setupCampaignEvents() {
  const wrap = document.getElementById('campaignButtonsGrid');
  if (!wrap || wrap.dataset.ready === '1') {
    refreshCampaignAdminUI().catch(console.error);
    return;
  }
  wrap.dataset.ready = '1';

  wrap.querySelectorAll('.campaign-apply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const campaign = btn.dataset.campaign;
      if (!campaign || typeof SiteTheme === 'undefined') return;

      btn.disabled = true;
      const prev = btn.innerHTML;
      btn.innerHTML = '<strong>Aplicando...</strong><span>Actualizando la tienda</span>';

      if (typeof gsap !== 'undefined') {
        gsap.to(btn, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 });
      }

      if (window.burstCampaignDecor) {
        window.burstCampaignDecor(btn, campaign);
      }

      try {
        const result = await SiteTheme.setActiveCampaign(campaign);
        await refreshCampaignAdminUI();
        if (result?.synced) showToast(`Campaña activada: ${CAMPAIGN_LABELS[campaign]} ✓`);
        else showToast(`Campaña activada en este navegador: ${CAMPAIGN_LABELS[campaign]} ✓`);
      } catch (err) {
        console.error(err);
        showToast('No se pudo activar la campaña. Inténtalo de nuevo.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  });

  document.getElementById('disableCampaignBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('disableCampaignBtn');
    if (!btn || typeof SiteTheme === 'undefined') return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Desactivando...';

    if (typeof gsap !== 'undefined') {
      gsap.to(btn, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 });
    }

    try {
      const result = await SiteTheme.setActiveCampaign('default');
      await refreshCampaignAdminUI();
      if (result?.synced) showToast('Campaña desactivada. Diseño normal restaurado ✓');
      else showToast('Diseño normal restaurado en este navegador ✓');
    } catch (err) {
      console.error(err);
      showToast('No se pudo desactivar la campaña.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  document.getElementById('autoCampaignBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('autoCampaignBtn');
    if (!btn || typeof SiteTheme === 'undefined') return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Activando...';

    if (typeof gsap !== 'undefined') {
      gsap.to(btn, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 });
    }

    try {
      const result = await SiteTheme.setAutomaticMode();
      await refreshCampaignAdminUI();
      if (result?.synced) showToast('Modo automático activado ✓');
      else showToast('Modo automático activado en este navegador ✓');
    } catch (err) {
      console.error(err);
      showToast('No se pudo activar el modo automático.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  refreshCampaignAdminUI().catch(console.error);
}

// ─── Exportar catálogo PDF ────────────────────────────────────────────────────

async function exportCatalogPDF() {
  const btn   = document.getElementById('exportPdfBtn');
  const label = document.getElementById('exportPdfLabel');
  if (btn)   { btn.disabled = true; btn.style.opacity = '.55'; }
  if (label) { label.textContent = 'Generando…'; }

  // Abrir ventana ANTES del await — iOS Safari bloquea window.open si no es
  // respuesta directa y síncrona al click del usuario (popup blocker)
  const win = window.open('', '_blank', 'width=920,height=760');
  if (!win) { showToast('Activa las ventanas emergentes para exportar el PDF.'); if (btn) { btn.disabled = false; btn.style.opacity = ''; } if (label) { label.textContent = 'Exportar PDF'; } return; }
  win.document.open();
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Generando catálogo…</title><style>body{background:#0a0a0a;color:#c9a84c;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:1.1rem;letter-spacing:.1em}</style></head><body>Generando catálogo…</body></html>');

  try {
    const all  = await CloudProducts.getAll();

    // Re-aplicar imágenes: PRODUCT_IMAGE_MAP > DEFAULT_PRODUCTS > lo que venga de Supabase
    const imgMap = typeof PRODUCT_IMAGE_MAP !== 'undefined' ? PRODUCT_IMAGE_MAP : {};
    const defById = {};
    if (typeof DEFAULT_PRODUCTS !== 'undefined') {
      DEFAULT_PRODUCTS.forEach(p => { if (p.imageUrl) defById[p.id] = p.imageUrl; });
    }
    all.forEach(p => {
      if (imgMap[p.name])               p.imageUrl = imgMap[p.name];   // mapa por nombre (máx. prioridad)
      else if (!p.imageUrl && defById[p.id]) p.imageUrl = defById[p.id]; // fallback DEFAULT_PRODUCTS por id
    });

    const base = window.location.origin;
    const date = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });

    // ── Helpers ──────────────────────────────────────────────────────────────
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Resuelve URL de imagen: admite data URIs (incluyendo SVG), http y rutas relativas con espacios
    const resolveImg = url => {
      if (!url || url.trim() === '') return '';
      if (url.startsWith('data:')) return url;           // SVG generado o base64 — usar directo
      if (url.startsWith('http'))  return encodeURI(url); // URL externa
      const path = url.startsWith('/') ? url : '/' + url;
      return encodeURI(base + path);                     // ruta relativa → absoluta (encodes espacios)
    };

    const gLabel = g => ({ hombre:'Hombre', mujer:'Mujer', unisex:'Unisex' }[g] || 'Unisex');
    const gColor = g => ({ hombre:'#2563eb', mujer:'#db2777', unisex:'#7c3aed' }[g] || '#7c3aed');
    const gIcon  = g => ({ hombre:'♂', mujer:'♀', unisex:'⚥' }[g] || '⚥');
    const oLabel = o => ({ dia:'Solo Día', noche:'Solo Noche', ambas:'Día & Noche' }[o] || 'Día & Noche');
    const oIcon  = o => ({ dia:'☀', noche:'☾', ambas:'☀☾' }[o] || '☀☾');

    // ── Merge: unir decant + entero del mismo perfume ─────────────────────────
    const enteroProds = all.filter(p => p.type === 'entero');
    const decantProds = all.filter(p => p.type !== 'entero');

    const normKey = p => (p.brand + '@@' + p.name).toLowerCase().trim();
    const enteroByKey = {};
    enteroProds.forEach(e => { enteroByKey[normKey(e)] = e; });

    const usedEnteroKeys = new Set();
    const mergedCards    = [];

    decantProds.forEach(d => {
      const key           = normKey(d);
      const matchedEntero = enteroByKey[key];
      let   enteroInfo    = null;

      if (matchedEntero && !usedEnteroKeys.has(key)) {
        usedEnteroKeys.add(key);
        enteroInfo = { sizes: matchedEntero.sizes, inStock: matchedEntero.inStock };
      } else if (d.availableAsEntero && d.enteroPrice > 0) {
        enteroInfo = { sizes: { 'Unidad': d.enteroPrice }, inStock: true };
      }

      mergedCards.push({ ...d, _decantSizes: d.sizes, _enteroInfo: enteroInfo });
    });

    // Enteros sin decant coincidente → sección propia
    const standaloneEnteros = enteroProds.filter(e => !usedEnteroKeys.has(normKey(e)));

    // ── Separar secciones ─────────────────────────────────────────────────────
    const diseCards   = mergedCards.filter(p => p.type === 'diseñador');
    const arabeCards  = mergedCards.filter(p => p.type === 'arabe');
    // Productos con tipo inesperado → mostrarlos igualmente en "Otros"
    const otrosCards  = mergedCards.filter(p => p.type !== 'diseñador' && p.type !== 'arabe');
    const enteroCards = standaloneEnteros;

    // ── Render de tarjeta ─────────────────────────────────────────────────────
    const renderCard = c => {
      const isEnteroOnly = !c._decantSizes;
      const g   = (c.gender   || 'unisex').toLowerCase();
      const o   = (c.occasion || 'ambas').toLowerCase();
      const gc  = gColor(g);
      const img = resolveImg(c.imageUrl);
      // Todos se muestran — sin stock solo lleva un badge informativo, sin difuminar
      const sinStock = !c.inStock && !(c._enteroInfo?.inStock);

      const imgHtml = img
        ? `<img class="c-img" src="${esc(img)}" alt="${esc(c.name)}" loading="lazy"
               onerror="this.style.display='none';this.nextSibling.style.display='flex'"
             ><div class="c-img-ph" style="display:none">${esc((c.brand||'?').charAt(0))}</div>`
        : `<div class="c-img-ph">${esc((c.brand||'?').charAt(0))}</div>`;

      // Precios decant
      let decantHtml = '';
      if (!isEnteroOnly && c._decantSizes) {
        const rows = Object.entries(c._decantSizes).map(([ml, pr]) =>
          `<tr><td class="td-s">${esc(ml)}</td><td class="td-p">${pr > 0 ? 'S/ ' + parseFloat(pr).toFixed(2) : '—'}</td></tr>`
        ).join('');
        decantHtml = `<div class="pr-col"><div class="pr-lbl">Decant</div><table class="pt"><tbody>${rows}</tbody></table></div>`;
      }

      // Precios entero (o espacio para llenar)
      let enteroHtml = '';
      if (!isEnteroOnly) {
        if (c._enteroInfo) {
          const rows = Object.entries(c._enteroInfo.sizes).map(([sz, pr]) =>
            `<tr><td class="td-s">${esc(sz)}</td><td class="td-p">${pr > 0 ? 'S/ ' + parseFloat(pr).toFixed(2) : '—'}</td></tr>`
          ).join('');
          enteroHtml = `<div class="pr-col"><div class="pr-lbl">Entero</div><table class="pt"><tbody>${rows}</tbody></table></div>`;
        } else {
          enteroHtml = `<div class="pr-col"><div class="pr-lbl">Entero</div><div class="blank-price">S/&nbsp;<span class="blank-line">___________</span></div></div>`;
        }
      } else {
        const rows = Object.entries(c.sizes || {}).map(([sz, pr]) =>
          `<tr><td class="td-s">${esc(sz)}</td><td class="td-p">${pr > 0 ? 'S/ ' + parseFloat(pr).toFixed(2) : '—'}</td></tr>`
        ).join('');
        enteroHtml = `<div class="pr-col" style="grid-column:1/-1"><div class="pr-lbl">Precio</div><table class="pt"><tbody>${rows}</tbody></table></div>`;
      }

      return `
      <div class="card">
        <div class="c-head">
          <div class="c-img-wrap">${imgHtml}</div>
          <div class="c-info">
            <div class="c-brand">${esc(c.brand)}</div>
            <div class="c-name">${esc(c.name)}</div>
            <div class="c-badges">
              <span class="badge" style="background:${gc}14;color:${gc};border:1px solid ${gc}33">${gIcon(g)} ${gLabel(g)}</span>
              <span class="badge b-occ">${oIcon(o)} ${oLabel(o)}</span>
              ${c.olfFamily ? `<span class="badge b-olf">${esc(c.olfFamily)}</span>` : ''}
              ${sinStock ? '<span class="badge" style="background:#fff0f0;color:#c0392b;border:1px solid #f5a5a5">Sin stock</span>' : ''}
            </div>
          </div>
        </div>
        <div class="c-prices">${decantHtml}${enteroHtml}</div>
      </div>`;
    };

    // ── Render de sección: chunks de 6, orden Hombre → Mujer → Unisex → Marca → Nombre ──
    let _firstSection = true;

    // mergeUnisex=true → unisex se muestra con hombre (Diseñador sin grupo Unisex separado)
    const renderSection = (title, icon, cards, mergeUnisex = false) => {
      if (!cards.length) return '';

      const isFirst   = _firstSection;
      _firstSection   = false;

      // Unisex en Diseñador va con Hombre (posición 0); en Árabes tiene su propio grupo (posición 2)
      const gOrd = mergeUnisex
        ? { hombre: 0, unisex: 0, mujer: 1 }
        : { hombre: 0, mujer: 1, unisex: 2 };

      // Ordenar: género → marca → nombre (sin headers dentro del grid)
      const sorted = [...cards].sort((a, b) => {
        const ga = gOrd[(a.gender||'unisex').toLowerCase()] ?? (mergeUnisex ? 0 : 2);
        const gb = gOrd[(b.gender||'unisex').toLowerCase()] ?? (mergeUnisex ? 0 : 2);
        if (ga !== gb) return ga - gb;
        const bc = a.brand.localeCompare(b.brand, 'es');
        return bc !== 0 ? bc : a.name.localeCompare(b.name, 'es');
      });

      // Partir en grupos de 6
      const chunks = [];
      for (let i = 0; i < sorted.length; i += 6) chunks.push(sorted.slice(i, i + 6));

      let html = `<div class="section${isFirst ? '' : ' new-page'}">`;
      html += `<div class="sec-title"><span>${icon}</span> ${title}<span class="sec-count">${cards.length} fragancia${cards.length !== 1 ? 's' : ''}</span></div>`;

      chunks.forEach((chunk, ci) => {
        const breakAfter = ci < chunks.length - 1;
        html += `<div class="chunk-grid${breakAfter ? ' break-after' : ''}">`;
        html += chunk.map(renderCard).join('');
        html += '</div>';
      });

      html += '</div>';
      return html;
    };

    const totalAll  = all.length;
    const totalDisp = all.filter(p => p.inStock).length;

    // ── HTML completo ─────────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>MICHT Decants — Catálogo ${date}</title>
<base href="${base}/">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Georgia','Times New Roman',serif;color:#1a1005;background:#fff;font-size:11pt;line-height:1.4}

/* Barra acción */
.pbar{position:sticky;top:0;z-index:200;background:#1a1005;padding:9px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pbar-btn{background:#c9a84c;color:#111;border:none;border-radius:6px;padding:7px 20px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.4px}
.pbar-btn:hover{background:#ddb84e}
.pbar-hint{color:#aaa;font-size:10px;font-family:sans-serif}

/* Layout */
.wrap{max-width:780px;margin:0 auto;padding:12px 16px 20px}

/* Cabecera */
.dh{text-align:center;padding-bottom:10px;margin-bottom:12px;border-bottom:2px solid #c9a84c}
.logo{font-size:20pt;font-weight:900;letter-spacing:2px}
.logo span{color:#c9a84c}
.sub{font-size:7pt;letter-spacing:3px;text-transform:uppercase;color:#888;margin-top:2px}
.meta{display:flex;justify-content:center;gap:16px;margin-top:6px;font-size:7pt;color:#666;font-family:sans-serif}
.meta b{color:#c9a84c}

/* Sección */
.section{margin-bottom:10px}
.sec-title{display:flex;align-items:center;gap:8px;font-size:9.5pt;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a1005;border-bottom:1.5px solid #c9a84c;padding-bottom:4px;margin-bottom:8px}
.sec-count{margin-left:auto;font-size:7pt;font-weight:400;color:#aaa;text-transform:none;letter-spacing:0;font-family:sans-serif}

/* Grid de 6 por página: 2 columnas × 3 filas de altura fija */
.chunk-grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:78mm;gap:4mm;page-break-inside:avoid;break-inside:avoid}
.break-after{page-break-after:always;break-after:page}
.new-page{page-break-before:always;break-before:page}

/* Tarjeta — altura fija por grid-auto-rows, overflow recortado */
.card{border:1px solid #dcd4b8;border-radius:10px;padding:12px 14px;background:#fffef9;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;height:100%;box-shadow:inset 0 0 10px rgba(201,168,76,0.03)}

.c-head{display:flex;gap:12px;margin-bottom:8px;align-items:center}
.c-img-wrap{flex-shrink:0;width:86px;height:86px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;border:1px solid #eae5d8;padding:4px}
.c-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px}
.c-img-ph{width:86px;height:86px;background:#f5eed8;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22pt;color:#c9a84c;font-weight:900;font-family:serif}
.c-info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px}
.c-brand{font-size:8pt;letter-spacing:1px;text-transform:uppercase;color:#b8932e;font-weight:700;font-family:sans-serif}
.c-name{font-size:12.5pt;font-weight:800;color:#1a1005;line-height:1.2;font-family:'Georgia',serif;margin:1px 0 3px}
.c-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.badge{font-size:7.2pt;padding:2px 6px;border-radius:20px;font-family:sans-serif;font-weight:600;white-space:nowrap}
.b-occ{background:#f5f0e4;color:#7a5f20;border:1px solid #d6c88a}
.b-olf{background:#f4f4f4;color:#666;border:1px solid #e0e0e0;font-style:italic;font-weight:400}

/* Precios */
.c-prices{display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid #ebdcb2;padding-top:6px;margin-top:3px}
.pr-col{}
.pr-lbl{font-size:7pt;text-transform:uppercase;letter-spacing:1px;color:#aaa;font-family:sans-serif;font-weight:700;margin-bottom:3px}
.pt{width:100%;border-collapse:collapse;font-family:sans-serif}
.pt tr{border-top:1px solid #f5f0ea}
.pt tr:first-child{border-top:none}
.td-s{color:#555;font-size:8.5pt;padding:2.5px 0;font-weight:600}
.td-p{text-align:right;font-weight:700;font-size:9.5pt;color:#1a1005;padding:2.5px 0}
.blank-price{font-size:9pt;color:#888;font-family:sans-serif;margin-top:2px}
.blank-line{color:#ccc;letter-spacing:1px}

/* Pie */
.df{margin-top:15px;padding-top:6px;border-top:1px solid #e0d5b8;text-align:center;font-size:7pt;color:#aaa;font-family:sans-serif}
.df b{color:#c9a84c}

@media print{
  .pbar{display:none!important}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{margin:0.4cm 0.6cm;size:A4 portrait}
  .wrap{max-width:100%!important;width:100%!important;margin:0!important;padding:2px 4px 6px!important}
  .dh{display:flex!important;justify-content:space-between!important;align-items:center!important;padding-bottom:4px!important;margin-bottom:8px!important;border-bottom:1.5px solid #c9a84c!important;text-align:left!important}
  .logo{font-size:16pt!important;font-weight:900!important}
  .sub{display:none!important}
  .meta{margin-top:0!important;font-size:7.2pt!important;gap:12px!important;display:flex!important;flex-direction:row!important}
  .sec-title{font-size:9pt;padding-bottom:2px;margin-bottom:4px}
  .section{margin-bottom:4px}
}
</style>
</head>
<body>

<div class="pbar">
  <button class="pbar-btn" onclick="window.print()">🖨&nbsp; Imprimir / Guardar PDF</button>
  <span class="pbar-hint">Elige <b style="color:#c9a84c">"Guardar como PDF"</b> como destino · Incluye <b style="color:#c9a84c">todos</b> los perfumes</span>
</div>

<div class="wrap">
  <div class="dh">
    <div class="logo">MICHT<span>Decants</span></div>
    <div class="sub">Catálogo de Fragancias &amp; Precios</div>
    <div class="meta">
      <span>Actualizado: <b>${date}</b></span>
      <span>Disponibles: <b>${totalDisp}</b> de <b>${totalAll}</b> fragancias</span>
      <span>WhatsApp: <b>917 452 643</b></span>
    </div>
  </div>

  ${renderSection('Diseñador', '💧', diseCards, true)}
  ${renderSection('Árabes', '🌙', arabeCards)}
  ${otrosCards.length ? renderSection('Otros', '✦', otrosCards) : ''}
  ${renderSection('Perfumes Enteros', '🛍', enteroCards)}

  <div class="df">
    <b>MICHT Decants</b> &nbsp;·&nbsp; WhatsApp 917 452 643 &nbsp;·&nbsp; Catálogo generado el ${date}<br>
    <span style="font-size:6.5pt;margin-top:2px;display:inline-block">Precios en soles peruanos (S/). Disponibilidad sujeta a stock.</span>
  </div>
</div>

</body>
</html>`;

    win.document.write(html);
    win.document.close();

  } catch (err) {
    console.error('[MICHT] Error generando PDF:', err);
    if (win && !win.closed) win.close();
    showToast('Error al generar el catálogo. Intenta de nuevo.');
  } finally {
    if (btn)   { btn.disabled = false; btn.style.opacity = ''; }
    if (label) { label.textContent = 'Exportar PDF'; }
  }
}

// ─── Modal de edición de pedido ───────────────────────────────────────────────

async function openEditOrderModal(id) {
  const order = await CloudOrders.getById(id);
  if (!order) { showToast('No se encontró el pedido.'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  const STATUS_LABELS = { pendiente:'Pendiente', pagado:'Pagado', cancelado:'Cancelado' };

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Editar Pedido ${sanitize(id)}</h3>
        <button id="closeEditModal" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer">✕</button>
      </div>

      <div style="padding:1.1rem 1.25rem;display:flex;flex-direction:column;gap:.9rem">

        <!-- Datos del cliente -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
          <div>
            <label style="font-size:.74rem;color:var(--text2);display:block;margin-bottom:.25rem">Nombre *</label>
            <input id="editName" type="text" value="${sanitize(order.customerName||'')}" maxlength="120"
              style="width:100%;padding:.42rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.83rem;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:.74rem;color:var(--text2);display:block;margin-bottom:.25rem">Teléfono</label>
            <input id="editPhone" type="tel" value="${sanitize(order.customerPhone||'')}" maxlength="20"
              style="width:100%;padding:.42rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.83rem;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:.74rem;color:var(--text2);display:block;margin-bottom:.25rem">DNI</label>
            <input id="editDni" type="text" value="${sanitize(order.customerDni||'')}" maxlength="8"
              style="width:100%;padding:.42rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.83rem;box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:.74rem;color:var(--text2);display:block;margin-bottom:.25rem">Entrega</label>
            <select id="editDelivery"
              style="width:100%;padding:.42rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.83rem;box-sizing:border-box">
              <option value="recojo" ${order.deliveryType==='recojo'?'selected':''}>🏪 Recojo</option>
              <option value="envio"  ${order.deliveryType==='envio' ?'selected':''}>📦 Shalom</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size:.74rem;color:var(--text2);display:block;margin-bottom:.25rem">Notas</label>
          <textarea id="editNotes" maxlength="300"
            style="width:100%;padding:.42rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.83rem;min-height:52px;box-sizing:border-box;resize:vertical">${sanitize(order.notes||'')}</textarea>
        </div>

        <!-- Productos editables -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
            <label style="font-size:.74rem;color:var(--text2);font-weight:600">Productos del pedido</label>
            <button id="editAddItemBtn" style="font-size:.72rem;padding:.28rem .7rem;background:var(--bg2);border:1px solid var(--border-l);color:var(--text2);border-radius:var(--r);cursor:pointer">+ Agregar</button>
          </div>
          <div id="editItemsList" style="display:flex;flex-direction:column;gap:.4rem"></div>
        </div>

        <!-- Total calculado -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;background:var(--bg2);border-radius:var(--r);border:1px solid var(--border)">
          <span style="font-size:.82rem;color:var(--text2)">Total calculado:</span>
          <strong id="editTotalDisplay" style="color:var(--gold);font-size:1rem">S/ 0.00</strong>
        </div>
      </div>

      <div style="display:flex;gap:.6rem;justify-content:flex-end;padding:.85rem 1.25rem;border-top:1px solid var(--border)">
        <button id="editCancelBtn" style="padding:.5rem 1.1rem;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:600;background:transparent;border:1px solid #555;color:#aaa">Cancelar</button>
        <button id="editSaveBtn" style="padding:.5rem 1.25rem;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:700;background:var(--gold);border:1px solid var(--gold);color:#111">Guardar cambios</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function closeModal() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 240);
  }
  overlay.querySelector('#closeEditModal').addEventListener('click', closeModal);
  overlay.querySelector('#editCancelBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // ── Renderizar items editables ─────────────────────────────────────────────
  const allProducts = await CloudProducts.getAll();
  const prodLookup  = {};
  allProducts.forEach(p => { prodLookup[p.id] = p; });

  let editItems = (order.items || []).map(i => ({ ...i }));

  function calcAndShowTotal() {
    const t = editItems.reduce((s, i) => s + (parseFloat(i.price)||0) * (parseInt(i.quantity)||1), 0);
    overlay.querySelector('#editTotalDisplay').textContent = `S/ ${t.toFixed(2)}`;
  }

  function renderEditItems() {
    const list = overlay.querySelector('#editItemsList');
    list.innerHTML = '';
    editItems.forEach((item, idx) => {
      const prod    = prodLookup[item.productId];
      const sizes   = prod ? Object.entries(prod.sizes || {}) : [];
      const row     = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr auto auto auto;gap:.4rem;align-items:center;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:.45rem .6rem';
      row.innerHTML = `
        <span style="font-size:.8rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${sanitize(item.brand||'')} ${sanitize(item.productName||'')}">${sanitize(item.brand||'')} — ${sanitize(item.productName||'')}</span>
        <select class="edit-size-sel" data-idx="${idx}"
          style="padding:.3rem .5rem;background:var(--card);border:1px solid var(--border-l);color:var(--text);border-radius:var(--r);font-size:.78rem;cursor:pointer">
          ${sizes.length
            ? sizes.map(([s, p]) => `<option value="${escapeAttr(s)}|${p}" ${s===item.size?'selected':''}>${s} — S/${p}</option>`).join('')
            : `<option value="${escapeAttr(item.size||'')}|${item.price||0}">${sanitize(item.size||'')} — S/${item.price||0}</option>`}
        </select>
        <input type="number" class="edit-qty-inp" data-idx="${idx}" min="1" max="99" value="${item.quantity||1}"
          style="width:54px;padding:.3rem .4rem;background:var(--card);border:1px solid var(--border-l);color:var(--text);border-radius:var(--r);font-size:.82rem;text-align:center">
        <button class="edit-remove-item" data-idx="${idx}"
          style="background:none;border:none;color:#666;font-size:1.1rem;cursor:pointer;padding:0 .2rem;line-height:1"
          onmouseover="this.style.color='#ef5350'" onmouseout="this.style.color='#666'">×</button>`;
      list.appendChild(row);
    });

    list.querySelectorAll('.edit-size-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = parseInt(sel.dataset.idx);
        const [sz, pr] = sel.value.split('|');
        editItems[i].size  = sz;
        editItems[i].price = parseFloat(pr) || editItems[i].price;
        calcAndShowTotal();
      });
    });
    list.querySelectorAll('.edit-qty-inp').forEach(inp => {
      inp.addEventListener('input', () => {
        editItems[parseInt(inp.dataset.idx)].quantity = parseInt(inp.value) || 1;
        calcAndShowTotal();
      });
    });
    list.querySelectorAll('.edit-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        editItems.splice(parseInt(btn.dataset.idx), 1);
        renderEditItems();
        calcAndShowTotal();
      });
    });
    calcAndShowTotal();
  }

  renderEditItems();

  // ── Agregar producto ───────────────────────────────────────────────────────
  overlay.querySelector('#editAddItemBtn').addEventListener('click', () => {
    const allOpts = [];
    allProducts.forEach(p => {
      if (p.type === 'entero') {
        Object.entries(p.sizes||{}).forEach(([s,pr]) => allOpts.push({ productId:p.id, brand:p.brand, productName:p.name, size:s, price:pr, quantity:1 }));
      } else {
        Object.entries(p.sizes||{}).forEach(([s,pr]) => allOpts.push({ productId:p.id, brand:p.brand, productName:p.name, size:s, price:pr, quantity:1 }));
      }
    });

    const picker = document.createElement('div');
    picker.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem';
    picker.innerHTML = `
      <div style="background:#1a1a1a;border:1px solid var(--border);border-radius:8px;width:100%;max-width:440px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.6)">
        <div style="padding:.75rem 1rem;border-bottom:1px solid var(--border);display:flex;gap:.5rem;align-items:center">
          <input id="pickSearch" type="text" placeholder="Buscar perfume..." autocomplete="off"
            style="flex:1;padding:.4rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.83rem">
          <button id="pickClose" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer">✕</button>
        </div>
        <div id="pickList" style="overflow-y:auto;max-height:55vh;padding:.4rem"></div>
      </div>`;
    document.body.appendChild(picker);

    const pickList   = picker.querySelector('#pickList');
    const pickSearch = picker.querySelector('#pickSearch');

    function renderPick(q = '') {
      const filtered = q ? allOpts.filter(o => `${o.brand} ${o.productName} ${o.size}`.toLowerCase().includes(q.toLowerCase())) : allOpts;
      pickList.innerHTML = filtered.slice(0, 60).map((o, i) => `
        <div class="pick-opt" data-i="${i + (q ? 0 : 0)}"
          style="padding:.45rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);font-size:.8rem;color:var(--text2);transition:background .1s"
          onmouseenter="this.style.background='var(--gold-dim)';this.style.color='var(--text)'"
          onmouseleave="this.style.background='';this.style.color='var(--text2)'">
          <strong>${sanitize(o.brand)}</strong> — ${sanitize(o.productName)} <span style="color:var(--gold)">${sanitize(o.size)}</span> <span style="float:right">S/ ${o.price}</span>
        </div>`).join('');
      pickList.querySelectorAll('.pick-opt').forEach((el, ri) => {
        const item = filtered[ri];
        if (!item) return;
        el.addEventListener('click', () => {
          editItems.push({ ...item, quantity: 1 });
          renderEditItems();
          picker.remove();
        });
      });
    }

    renderPick();
    pickSearch.addEventListener('input', () => renderPick(pickSearch.value));
    picker.querySelector('#pickClose').addEventListener('click', () => picker.remove());
    picker.addEventListener('click', e => { if (e.target === picker) picker.remove(); });
    setTimeout(() => pickSearch.focus(), 80);
  });

  // ── Guardar cambios ────────────────────────────────────────────────────────
  overlay.querySelector('#editSaveBtn').addEventListener('click', async () => {
    const name     = overlay.querySelector('#editName').value.trim();
    const phone    = overlay.querySelector('#editPhone').value.trim();
    const dni      = overlay.querySelector('#editDni').value.trim();
    const delivery = overlay.querySelector('#editDelivery').value;
    const notes    = overlay.querySelector('#editNotes').value.trim();
    const saveBtn2 = overlay.querySelector('#editSaveBtn');

    if (!name) { showToast('Ingresa el nombre del cliente.'); return; }
    if (!editItems.length) { showToast('El pedido debe tener al menos un producto.'); return; }

    saveBtn2.disabled    = true;
    saveBtn2.textContent = 'Guardando…';

    const newTotal = editItems.reduce((s, i) => s + (parseFloat(i.price)||0) * (parseInt(i.quantity)||1), 0);

    try {
      await CloudOrders.update(id, {
        customerName: name, customerPhone: phone, customerDni: dni,
        deliveryType: delivery, notes, items: editItems, total: newTotal
      });
      showToast(`Pedido ${id} actualizado ✓`);
      closeModal();
      renderOrdersSection().catch(console.error);
    } catch (err) {
      console.error(err);
      showToast('Error al guardar. Inténtalo de nuevo.');
    } finally {
      saveBtn2.disabled    = false;
      saveBtn2.textContent = 'Guardar cambios';
    }
  });
}

// ─── Modal de método de pago ──────────────────────────────────────────────────

function showPaymentModal(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #c9a84c;border-radius:10px;padding:1.5rem 1.75rem;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h3 style="margin:0;font-size:1rem;color:#c9a84c;font-weight:700">Confirmar pago</h3>
        <button id="pmClose" style="background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer">✕</button>
      </div>
      <p style="margin:0;color:#e0d5c5;font-size:.88rem;white-space:pre-line;line-height:1.55">${sanitize(message)}</p>
      <p style="margin:0;font-size:.8rem;color:var(--text2);font-weight:600">¿Cómo se realizó el pago?</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem">
        <button id="pmEfectivo" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1e3a20;border:2px solid #4caf50;color:#4caf50;transition:all .15s"
          onmouseover="this.style.background='#2a4f2c'" onmouseout="this.style.background='#1e3a20'">
          💵<br><span style="font-size:.8rem">Efectivo</span>
        </button>
        <button id="pmYape" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1e1a3a;border:2px solid #7c3aed;color:#a78bfa;transition:all .15s"
          onmouseover="this.style.background='#2a2050'" onmouseout="this.style.background='#1e1a3a'">
          📱<br><span style="font-size:.8rem">Yape</span>
        </button>
        <button id="pmPlin" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1a2a3a;border:2px solid #29b6f6;color:#4fc3f7;transition:all .15s"
          onmouseover="this.style.background='#1e3347'" onmouseout="this.style.background='#1a2a3a'">
          📲<br><span style="font-size:.8rem">Plin</span>
        </button>
        <button id="pmTransferencia" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1e2a1e;border:2px solid #66bb6a;color:#a5d6a7;transition:all .15s"
          onmouseover="this.style.background='#263226'" onmouseout="this.style.background='#1e2a1e'">
          🏦<br><span style="font-size:.8rem">Transferencia</span>
        </button>
      </div>
      <button id="pmCancel" style="padding:.45rem;border-radius:6px;cursor:pointer;font-size:.82rem;font-weight:600;background:transparent;border:1px solid #444;color:#888">Cancelar</button>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function cleanup() { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 240); }

  overlay.querySelector('#pmEfectivo').addEventListener('click',     () => { cleanup(); onConfirm('efectivo'); });
  overlay.querySelector('#pmYape').addEventListener('click',         () => { cleanup(); onConfirm('yape'); });
  overlay.querySelector('#pmPlin').addEventListener('click',         () => { cleanup(); onConfirm('plin'); });
  overlay.querySelector('#pmTransferencia').addEventListener('click',() => { cleanup(); onConfirm('transferencia'); });
  overlay.querySelector('#pmCancel').addEventListener('click',   () => { cleanup(); if (onCancel) onCancel(); });
  overlay.querySelector('#pmClose').addEventListener('click',    () => { cleanup(); if (onCancel) onCancel(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(); if (onCancel) onCancel(); } });
}

// ─── Modal de confirmación (totalmente dinámico, sin dependencia de HTML) ────

function showConfirmModal(message, onOk, onCancel) {
  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:10000',
    'background:rgba(0,0,0,.72)',
    'display:flex;align-items:center;justify-content:center',
    'padding:1rem',
    'opacity:0;transition:opacity .22s ease'
  ].join(';');

  // Caja del diálogo
  const box = document.createElement('div');
  box.style.cssText = [
    'background:#1a1a1a',
    'border:1px solid #c9a84c',
    'border-radius:10px',
    'padding:1.5rem 1.75rem',
    'max-width:420px;width:100%',
    'box-shadow:0 8px 32px rgba(0,0,0,.6)',
    'display:flex;flex-direction:column;gap:1rem'
  ].join(';');

  // Encabezado
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem';

  const title = document.createElement('h3');
  title.textContent = 'Confirmar acción';
  title.style.cssText = 'margin:0;font-size:1rem;color:#c9a84c;font-weight:700';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer;line-height:1;padding:0';

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Cuerpo del mensaje
  const body = document.createElement('p');
  body.style.cssText = 'margin:0;color:#e0d5c5;font-size:.88rem;white-space:pre-line;line-height:1.55';
  body.textContent = message;

  // Pie con botones
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:.75rem;justify-content:flex-end;flex-wrap:wrap';

  const btnCan = document.createElement('button');
  btnCan.textContent = 'Cancelar';
  btnCan.style.cssText = [
    'padding:.55rem 1.1rem;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:600',
    'background:transparent;border:1px solid #555;color:#aaa'
  ].join(';');

  const btnOk = document.createElement('button');
  btnOk.textContent = 'Confirmar';
  btnOk.style.cssText = [
    'padding:.55rem 1.25rem;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:700',
    'background:#c9a84c;border:1px solid #c9a84c;color:#111'
  ].join(';');

  footer.appendChild(btnCan);
  footer.appendChild(btnOk);

  box.appendChild(header);
  box.appendChild(body);
  box.appendChild(footer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Fade-in
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function cleanup() {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); }, 240);
  }
  function handleOk()     { cleanup(); onOk(); }
  function handleCancel() { cleanup(); if (onCancel) onCancel(); }

  btnOk.addEventListener('click',   handleOk);
  btnCan.addEventListener('click',  handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  // Cerrar al hacer clic fuera del diálogo
  overlay.addEventListener('click', e => { if (e.target === overlay) handleCancel(); });
}

// ─── Toast de notificación ────────────────────────────────────────────────────

function showToast(msg) {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    // En móvil se posiciona a la izquierda para no solapar con newOrderToast (derecha)
    t.style.cssText = 'position:fixed;bottom:1.5rem;left:1rem;max-width:calc(100vw - 2rem);background:var(--card);border:1px solid var(--gold-d);color:var(--text);padding:.75rem 1.25rem;border-radius:var(--r);font-size:.85rem;z-index:9999;box-shadow:var(--sh);transition:all .3s;opacity:0;transform:translateY(10px)';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, 2800);
}

function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ─── Sección: Usuarios ───────────────────────────────────────────────────────

async function renderUsersSection() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Cargando usuarios…</td></tr>';

  const hint = document.getElementById('usersSqlHint');

  if (!db) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Base de datos no disponible.</td></tr>';
    return;
  }

  // ── Obtener perfiles (await directo — el builder de Supabase no es un Promise nativo) ──
  let profilesData = [], profilesErr = null;
  try {
    const res = await db.from('perfiles_usuarios').select('*').order('created_at', { ascending: false });
    profilesData = res.data  || [];
    profilesErr  = res.error || null;
  } catch (e) {
    profilesErr = e;
  }

  if (profilesErr) {
    const code = profilesErr.code || '';
    const msg  = String(profilesErr.message || profilesErr.details || '');
    const isPermission = code === '42501' || code === '42P01' || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('does not exist');
    if (hint) hint.style.display = isPermission ? '' : 'none';
    tbody.innerHTML = isPermission
      ? '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Sin acceso — ejecuta el SQL de arriba en Supabase para habilitar esta sección.</td></tr>'
      : `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Error al cargar usuarios: ${sanitize(msg || code || 'desconocido')}</td></tr>`;
    return;
  }

  if (hint) hint.style.display = 'none';

  // ── Obtener pedidos para cruzar por DNI (falla silenciosa) ──
  let orders = [];
  try { orders = await CloudOrders.getAll(); } catch (_) {}

  const ordersByDni = {};
  orders.forEach(o => {
    const dni = (o.customerDni || '').trim();
    if (!dni) return;
    if (!ordersByDni[dni]) ordersByDni[dni] = { count: 0, total: 0 };
    ordersByDni[dni].count++;
    if (o.status === 'pagado') ordersByDni[dni].total += (o.total || 0);
  });

  updateUsersStats(profilesData, ordersByDni);

  // ── Filtro de búsqueda ────────────────────────────────────────────────────────
  let filtered = profilesData;
  if (_userSearch) {
    const q = _userSearch.toLowerCase();
    filtered = profilesData.filter(p =>
      (p.nombre_completo || '').toLowerCase().includes(q) ||
      (p.dni  || '').includes(q) ||
      (p.telefono || '').includes(q)
    );
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">${
      profilesData.length ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios registrados aún.'
    }</td></tr>`;
    return;
  }

  const tdS = 'padding:.5rem .7rem;font-size:.80rem;border-bottom:1px solid var(--border);vertical-align:middle';

  tbody.innerHTML = filtered.map(p => {
    const stats    = ordersByDni[(p.dni || '').trim()] || { count: 0, total: 0 };
    const regDate  = new Date(p.created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const discBadge = p.primer_descuento_usado
      ? '<span style="font-size:.72rem;background:rgba(239,83,80,.12);color:#ef5350;padding:.15rem .55rem;border-radius:3px;white-space:nowrap">Usado</span>'
      : '<span style="font-size:.72rem;background:rgba(76,175,80,.12);color:#4caf50;padding:.15rem .55rem;border-radius:3px;white-space:nowrap">Disponible</span>';

    return `<tr>
      <td style="${tdS}"><strong style="color:var(--text)">${sanitize(p.nombre_completo || '—')}</strong></td>
      <td style="${tdS};font-family:monospace;color:var(--text2);letter-spacing:.04em">${sanitize(p.dni || '—')}</td>
      <td style="${tdS}"><a href="https://wa.me/51${escapeAttr((p.telefono||'').replace(/\D/g,''))}" target="_blank" rel="noopener"
            style="color:var(--gold);text-decoration:none" onmouseover="this.style.opacity='.7'" onmouseout="this.style.opacity='1'">📱 ${sanitize(p.telefono || '—')}</a></td>
      <td style="${tdS};text-align:center">${discBadge}</td>
      <td style="${tdS};color:var(--text2);font-size:.75rem;white-space:nowrap">${regDate}</td>
      <td style="${tdS};text-align:center;color:${stats.count > 0 ? 'var(--gold)' : 'var(--text3)'}"><strong>${stats.count || '—'}</strong></td>
      <td style="${tdS};text-align:right;font-weight:${stats.total > 0 ? '700' : '400'};color:${stats.total > 0 ? 'var(--green)' : 'var(--text3)'}">
        ${stats.total > 0 ? `S/ ${stats.total.toFixed(2)}` : '—'}
      </td>
      <td style="${tdS};text-align:center">
        <button class="btn-view-user-orders" data-dni="${escapeAttr(p.dni || '')}" data-name="${escapeAttr(p.nombre_completo || '')}"
                style="font-size:.72rem;padding:.3rem .65rem;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:var(--r);cursor:pointer;transition:all .15s;white-space:nowrap"
                onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">Ver pedidos</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-view-user-orders').forEach(btn => {
    btn.addEventListener('click', () => openUserOrdersModal(btn.dataset.dni, btn.dataset.name));
  });
}

function updateUsersStats(profiles, ordersByDni) {
  const bar = document.getElementById('usersStatsBar');
  if (!bar) return;
  const total       = profiles.length;
  const discAvail   = profiles.filter(p => !p.primer_descuento_usado).length;
  const discUsed    = profiles.filter(p =>  p.primer_descuento_usado).length;
  const conPedidos  = profiles.filter(p => (ordersByDni[(p.dni||'').trim()]?.count || 0) > 0).length;
  bar.innerHTML = `
    <div class="stat-card"><div class="stat-val" style="color:var(--gold)">${total}</div><div class="stat-label">Total usuarios</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#4caf50">${discAvail}</div><div class="stat-label">Con 10% OFF</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--text2)">${discUsed}</div><div class="stat-label">Descuento usado</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#60a5fa">${conPedidos}</div><div class="stat-label">Con pedidos</div></div>
  `;
}

async function openUserOrdersModal(dni, name) {
  if (!dni) { showToast('Este usuario no tiene DNI registrado.'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;padding:1.5rem;max-width:560px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Pedidos de ${sanitize(name)}</h3>
        <button id="closeUserOrdersModal" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;line-height:1;padding:0 .2rem">✕</button>
      </div>
      <div id="userOrdersList" style="display:flex;flex-direction:column;gap:.5rem">
        <p style="color:var(--text2);text-align:center;padding:1.5rem">Cargando…</p>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function closeModal() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 240);
  }
  overlay.querySelector('#closeUserOrdersModal').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  try {
    const allOrders = await withTimeout(CloudOrders.getAll(), 15000, 'los pedidos del usuario');
    const userOrders = allOrders.filter(o => (o.customerDni || '').trim() === dni.trim());
    const list = overlay.querySelector('#userOrdersList');

    if (!userOrders.length) {
      list.innerHTML = '<p style="color:var(--text2);text-align:center;padding:1.5rem">Este usuario no tiene pedidos registrados.</p>';
      return;
    }

    const STATUS_LABELS = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };
    list.innerHTML = userOrders.map(o => {
      const date  = new Date(o.date).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
      const items = (o.items || []).map(i => `${sanitize(i.productName)} ${sanitize(i.size)} ×${i.quantity}`).join(' · ');
      const safeStatus = (o.status || '').replace(/[^a-z]/g, '');
      return `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.75rem 1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem">
            <span class="order-id">${sanitize(o.id)}</span>
            <span class="status-badge status-${safeStatus}">${STATUS_LABELS[o.status] ?? sanitize(o.status)}</span>
            <span style="font-size:.73rem;color:var(--text3)">${date}</span>
          </div>
          <div style="font-size:.78rem;color:var(--text2);margin-bottom:.35rem">${items || '—'}</div>
          <div style="display:flex;justify-content:space-between;font-size:.8rem">
            <span style="color:var(--text3)">${o.deliveryType === 'envio' ? '📦 Shalom' : '🏪 Recojo'}</span>
            <strong style="color:var(--gold)">S/ ${o.total.toFixed(2)}</strong>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    overlay.querySelector('#userOrdersList').innerHTML = '<p style="color:var(--text2);text-align:center">Error al cargar los pedidos.</p>';
  }
}

function setupUsersEvents() {
  document.getElementById('userSearch')?.addEventListener('input', function() {
    _userSearch = this.value.trim();
    renderUsersSection().catch(console.error);
  });

  document.getElementById('refreshUsersBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshUsersBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
    await renderUsersSection().catch(console.error);
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    showToast('Usuarios actualizados ✓');
  });
}

// ─── Sección: Contabilidad ────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Gastos: localStorage como cache + Supabase para sync entre dispositivos ──
// SQL para crear la tabla (ejecutar en Supabase SQL Editor una sola vez):
//
// CREATE TABLE IF NOT EXISTS gastos (
//   id          SERIAL PRIMARY KEY,
//   year        INTEGER NOT NULL,
//   month       INTEGER NOT NULL,
//   description TEXT    NOT NULL,
//   amount      NUMERIC NOT NULL,
//   created_at  TIMESTAMPTZ DEFAULT NOW()
// );
// ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "admin_gastos" ON gastos FOR ALL TO authenticated USING (true);
//
// ─────────────────────────────────────────────────────────────────────────────

async function getExpenses(year) {
  // Intentar cargar desde Supabase (sync entre dispositivos)
  if (db) {
    try {
      const { data, error } = await db.from('gastos').select('*').eq('year', year);
      if (!error && data) {
        // Convertir a formato legacy {month, description, amount, date}
        const remote = data.map(r => ({ id: r.id, month: r.month, description: r.description, amount: parseFloat(r.amount), date: r.created_at }));
        localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(remote));
        return remote;
      }
    } catch (_) {}
  }
  // Fallback: localStorage
  try { return JSON.parse(localStorage.getItem(`micht_expenses_${year}`) || '[]'); }
  catch { return []; }
}

async function addExpense(year, month, description, amount) {
  const newExp = { month, description, amount, date: new Date().toISOString() };
  // Guardar en Supabase
  if (db) {
    try {
      const { data, error } = await db.from('gastos').insert({ year, month, description, amount }).select().single();
      if (!error && data) newExp.id = data.id;
    } catch (_) {}
  }
  // Guardar en localStorage
  const local = JSON.parse(localStorage.getItem(`micht_expenses_${year}`) || '[]');
  local.push(newExp);
  localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(local));
  return newExp;
}

async function deleteExpense(year, expenseId, localIdx) {
  // Eliminar de Supabase por id si existe
  if (db && expenseId) {
    try { await db.from('gastos').delete().eq('id', expenseId); } catch (_) {}
  }
  // Eliminar de localStorage
  const local = JSON.parse(localStorage.getItem(`micht_expenses_${year}`) || '[]');
  local.splice(localIdx, 1);
  localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(local));
}

// saveExpenses mantiene compatibilidad con el código legacy (contabilidad mensual)
function saveExpenses(year, expenses) {
  localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(expenses));
}

async function getMonthlyStats(orders, year) {
  const filtered = orders.filter(o => new Date(o.date).getFullYear() === year);
  const expenses = await getExpenses(year);
  return Array.from({ length: 12 }, (_, m) => {
    const monthOrders = filtered.filter(o => new Date(o.date).getMonth() === m);
    const paid        = monthOrders.filter(o => o.status === 'pagado');
    const cancelled   = monthOrders.filter(o => o.status === 'cancelado');
    const revenue     = paid.reduce((s, o) => s + o.total, 0);
    const monthExp    = expenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0);
    return { month: m, name: MONTH_NAMES[m], orders: monthOrders.length, paid: paid.length, cancelled: cancelled.length, revenue, expenses: monthExp, net: revenue - monthExp };
  });
}

async function renderAccountingSection() {
  const yearSel = document.getElementById('accountingYear');
  if (!yearSel) return;

  const allOrders = await CloudOrders.getAll();

  // Poblar años disponibles
  const rawYears  = allOrders.map(o => new Date(o.date).getFullYear()).filter(y => !isNaN(y));
  const thisYear  = new Date().getFullYear();
  const years     = [...new Set([thisYear, ...rawYears])].sort((a, b) => b - a);

  if (!yearSel.dataset.filled) {
    yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSel.dataset.filled = '1';
  }

  const year  = parseInt(yearSel.value) || thisYear;
  const stats = await getMonthlyStats(allOrders, year);
  const now   = new Date();

  // Calcular totales
  const totalRevenue  = stats.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = stats.reduce((s, m) => s + m.expenses, 0);
  const totalNet      = totalRevenue - totalExpenses;
  const bestMonth     = stats.reduce((b, m) => m.revenue > b.revenue ? m : b, stats[0]);
  const currentMonth  = stats[now.getMonth()];
  const paidTotal     = stats.reduce((s, m) => s + m.paid, 0);
  const activeMonths  = stats.filter(m => m.revenue > 0).length || 1;

  // Desglose por método de pago
  const paidOrders = allOrders.filter(o => o.status === 'pagado' && new Date(o.date).getFullYear() === year);
  const revEfectivo = paidOrders.filter(o => o.paymentMethod === 'efectivo').reduce((s,o) => s + o.total, 0);
  const revYape     = paidOrders.filter(o => o.paymentMethod === 'yape').reduce((s,o) => s + o.total, 0);
  const revSinMet   = paidOrders.filter(o => !o.paymentMethod).reduce((s,o) => s + o.total, 0);

  // ── Tarjetas de resumen ──────────────────────────────────────────────────────
  const summary = document.getElementById('accountingSummary');
  summary.innerHTML = [
    { label: `Total ${year}`, val: `S/ ${totalRevenue.toFixed(0)}`, sub: `${paidTotal} pedidos pagados`, color: 'var(--gold)' },
    { label: 'Mejor Mes',    val: bestMonth.revenue > 0 ? bestMonth.name : '—', sub: bestMonth.revenue > 0 ? `S/ ${bestMonth.revenue.toFixed(0)}` : 'Sin ventas aún', color: 'var(--green)' },
    { label: year === thisYear ? 'Mes Actual' : `Dic ${year}`, val: `S/ ${(year === thisYear ? currentMonth : stats[11]).revenue.toFixed(0)}`, sub: `${(year === thisYear ? currentMonth : stats[11]).paid} pagados`, color: 'var(--gold-d)' },
    { label: '💵 Efectivo',  val: `S/ ${revEfectivo.toFixed(0)}`, sub: `${paidOrders.filter(o=>o.paymentMethod==='efectivo').length} pedidos`, color: '#4caf50' },
    { label: '📱 Yape',      val: `S/ ${revYape.toFixed(0)}`,     sub: `${paidOrders.filter(o=>o.paymentMethod==='yape').length} pedidos`,     color: '#7c3aed' },
    { label: 'Gastos Totales', val: `S/ ${totalExpenses.toFixed(0)}`, sub: 'registrados manualmente', color: '#ef5350' },
    { label: 'Neto (Ingr.−Gastos)', val: `S/ ${totalNet.toFixed(0)}`, sub: `Prom/mes: S/ ${(totalRevenue / activeMonths).toFixed(0)}`, color: totalNet >= 0 ? 'var(--green)' : '#ef5350' }
  ].map(c => `
    <div class="stat-card" style="text-align:left;padding:1rem 1.1rem">
      <div class="stat-label" style="margin-bottom:.35rem">${c.label}</div>
      <div class="stat-val" style="color:${c.color};font-size:1.25rem;line-height:1.2">${c.val}</div>
      <div style="font-size:.7rem;color:var(--text3);margin-top:.3rem">${c.sub}</div>
    </div>`).join('');

  // ── Gráfico de barras ────────────────────────────────────────────────────────
  setTimeout(() => drawAccountingChart(stats, year), 0);

  // ── Tabla mensual ────────────────────────────────────────────────────────────
  const tbody = document.getElementById('accountingTableBody');
  tbody.innerHTML = stats.map(m => {
    const isCurrent = m.month === now.getMonth() && year === thisYear;
    const isBest    = m.revenue > 0 && m.month === bestMonth.month;
    return `
    <tr style="${isCurrent ? 'background:rgba(201,168,76,.06)' : ''}">
      <td>
        <span style="font-weight:${isCurrent ? '700' : '400'};color:${isCurrent ? 'var(--gold)' : 'var(--text)'}">
          ${m.name}${isCurrent ? '&nbsp;<span style="font-size:.66rem;color:var(--gold-d);font-weight:400">(actual)</span>' : ''}
        </span>
        ${isBest ? '&nbsp;<span style="font-size:.68rem;background:rgba(76,175,80,.15);color:#4caf50;padding:.1rem .45rem;border-radius:3px;font-weight:600">⭐ mejor</span>' : ''}
      </td>
      <td style="text-align:center;color:var(--text2)">${m.orders || '—'}</td>
      <td style="text-align:center;color:${m.cancelled ? '#ef5350' : 'var(--text3)'}">${m.cancelled || '—'}</td>
      <td style="text-align:right;font-weight:600;color:${m.revenue > 0 ? 'var(--green)' : 'var(--text3)'}">${m.revenue > 0 ? `S/ ${m.revenue.toFixed(2)}` : '—'}</td>
      <td style="text-align:right">
        <span style="color:${m.expenses > 0 ? '#ef5350' : 'var(--text3)'}">${m.expenses > 0 ? `S/ ${m.expenses.toFixed(2)}` : '—'}</span>
        <button class="btn-expense-detail" data-month="${m.month}" data-year="${year}"
                style="margin-left:.45rem;font-size:.7rem;padding:.15rem .5rem;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:3px;cursor:pointer;transition:all .15s"
                onmouseover="this.style.borderColor='var(--gold-d)';this.style.color='var(--gold)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'"
                title="Ver / agregar gastos de ${m.name}">+</button>
      </td>
      <td style="text-align:right;font-weight:700;color:${m.net > 0 ? 'var(--gold)' : m.net < 0 ? '#ef5350' : 'var(--text3)'}">
        ${(m.revenue > 0 || m.expenses > 0) ? `S/ ${m.net.toFixed(2)}` : '—'}
      </td>
      <td style="text-align:center">
        <button class="btn-days-detail" data-month="${m.month}" data-year="${year}"
                style="font-size:.78rem;padding:.2rem .55rem;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:3px;cursor:pointer;transition:all .15s"
                onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)';this.style.background='rgba(201,168,76,.08)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)';this.style.background='transparent'"
                title="Ver días de ${m.name}">📅</button>
      </td>
    </tr>`;
  }).join('');

  // Fila de totales
  tbody.innerHTML += `
    <tr style="background:var(--bg2);border-top:2px solid var(--border)">
      <td style="font-weight:700;color:var(--text);font-size:.85rem">TOTAL ${year}</td>
      <td style="text-align:center;font-weight:700;color:var(--gold)">${stats.reduce((s,m)=>s+m.orders,0)}</td>
      <td style="text-align:center;font-weight:700;color:#ef5350">${stats.reduce((s,m)=>s+m.cancelled,0) || '—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--green)">S/ ${totalRevenue.toFixed(2)}</td>
      <td style="text-align:right;font-weight:700;color:#ef5350">${totalExpenses > 0 ? `S/ ${totalExpenses.toFixed(2)}` : '—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--gold)">S/ ${totalNet.toFixed(2)}</td>
      <td></td>
    </tr>`;

  // Eventos de detalle de gastos
  tbody.querySelectorAll('.btn-expense-detail').forEach(btn => {
    btn.addEventListener('click', () => openExpenseModal(parseInt(btn.dataset.month), parseInt(btn.dataset.year)));
  });

  // Eventos de detalle diario
  tbody.querySelectorAll('.btn-days-detail').forEach(btn => {
    btn.addEventListener('click', () => renderDailyView(allOrders, parseInt(btn.dataset.year), parseInt(btn.dataset.month)));
  });
}

function drawAccountingChart(stats, year) {
  const canvas = document.getElementById('accountingChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.parentElement.offsetWidth - 48;
  if (W <= 0) return;
  const H   = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const padL = 52, padR = 8, padT = 22, padB = 38;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const maxRev = Math.max(...stats.map(m => m.revenue), 1);
  const barW   = cW / 12;
  const barGap = barW * 0.28;
  const bw     = barW - barGap;

  ctx.clearRect(0, 0, W, H);

  // Grid + labels eje Y
  for (let i = 0; i <= 4; i++) {
    const y   = padT + cH - cH * i / 4;
    const val = Math.round(maxRev * i / 4);
    ctx.font      = `10px Inter, sans-serif`;
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText(`S/${val}`, padL - 5, y + 4);
    ctx.beginPath();
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth   = 0.8;
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + cW, y);
    ctx.stroke();
  }

  const nowMonth  = new Date().getMonth();
  const thisYear  = new Date().getFullYear();
  const bestRev   = Math.max(...stats.map(m => m.revenue));

  stats.forEach((m, i) => {
    const x    = padL + i * barW + barGap / 2;
    const barH = (m.revenue / maxRev) * cH;
    const y    = padT + cH - barH;

    const isBest    = m.revenue > 0 && m.revenue === bestRev;
    const isCurrent = i === nowMonth && year === thisYear;

    if (m.revenue === 0) {
      ctx.fillStyle = '#252525';
      ctx.fillRect(x, padT + cH - 3, bw, 3);
    } else {
      const grad = ctx.createLinearGradient(0, y, 0, padT + cH);
      if (isBest) {
        grad.addColorStop(0, '#c9a84c');
        grad.addColorStop(1, '#7a5c1e');
      } else if (isCurrent) {
        grad.addColorStop(0, '#4da6ff');
        grad.addColorStop(1, '#1a4a7a');
      } else {
        grad.addColorStop(0, '#5a5a5a');
        grad.addColorStop(1, '#2a2a2a');
      }
      ctx.fillStyle = grad;
      const r = Math.min(3, bw / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, padT + cH);
      ctx.lineTo(x, padT + cH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      if (barH > 14) {
        ctx.fillStyle   = 'rgba(255,255,255,.85)';
        ctx.font        = '9px Inter, sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText(`${m.revenue.toFixed(0)}`, x + bw / 2, y - 4);
      }
    }

    // Etiqueta mes
    ctx.fillStyle = isCurrent ? '#c9a84c' : '#666';
    ctx.font      = `${isCurrent ? '600 ' : ''}10px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(m.name.slice(0, 3), x + bw / 2, padT + cH + 16);
  });
}

async function openExpenseModal(month, year) {
  let overlay = document.getElementById('expenseOverlay');
  if (overlay) overlay.remove();

  const allExp    = await getExpenses(year);
  const expenses  = allExp.filter(e => e.month === month);
  const total     = expenses.reduce((s, e) => s + e.amount, 0);
  const monthName = MONTH_NAMES[month];

  overlay = document.createElement('div');
  overlay.id = 'expenseOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;padding:1.5rem;max-width:440px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:1rem;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Gastos — ${monthName} ${year}</h3>
        <button id="closeExpenseModal" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;line-height:1;padding:0 .2rem">✕</button>
      </div>

      <div id="expenseList" style="display:flex;flex-direction:column;gap:.45rem;min-height:30px">
        ${expenses.length ? expenses.map((e, i) => `
          <div style="display:flex;align-items:center;gap:.5rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:.5rem .75rem">
            <span style="flex:1;font-size:.83rem;color:var(--text2)">${sanitize(e.description)}</span>
            <span style="font-size:.83rem;font-weight:700;color:#ef5350;white-space:nowrap">S/ ${e.amount.toFixed(2)}</span>
            <button class="del-expense-btn" data-idx="${i}"
                    style="background:none;border:none;color:#555;cursor:pointer;font-size:1.1rem;padding:0 .2rem;line-height:1;transition:color .15s"
                    onmouseover="this.style.color='#ef5350'" onmouseout="this.style.color='#555'">×</button>
          </div>`).join('')
        : '<p style="color:var(--text3);font-size:.82rem;text-align:center;padding:.4rem 0">Sin gastos registrados este mes</p>'}
      </div>

      ${total > 0 ? `<div style="text-align:right;font-size:.85rem;color:#ef5350;font-weight:700;border-top:1px solid var(--border);padding-top:.65rem">Total gastos: S/ ${total.toFixed(2)}</div>` : ''}

      <div style="border-top:1px solid var(--border);padding-top:.8rem">
        <p style="font-size:.78rem;color:var(--text2);margin-bottom:.55rem;font-weight:600">Agregar nuevo gasto</p>
        <div style="display:flex;gap:.45rem;flex-wrap:wrap">
          <input type="text" id="expenseDesc" placeholder="Descripción (ej: Empaques, Envíos…)" maxlength="100"
                 style="flex:2;min-width:140px;padding:.42rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.82rem;outline:none"
                 onfocus="this.style.borderColor='var(--gold-d)'" onblur="this.style.borderColor='var(--border)'">
          <input type="number" id="expenseAmount" placeholder="S/ 0.00" min="0.01" step="0.5" max="99999"
                 style="width:90px;padding:.42rem .55rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.82rem;outline:none"
                 onfocus="this.style.borderColor='var(--gold-d)'" onblur="this.style.borderColor='var(--border)'">
          <button id="saveExpenseBtn"
                  style="padding:.42rem 1rem;background:var(--gold);color:#111;border:none;border-radius:var(--r);font-size:.82rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .2s"
                  onmouseover="this.style.background='var(--gold-l)'" onmouseout="this.style.background='var(--gold)'">Agregar</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function closeModal() {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); renderAccountingSection().catch(console.error); }, 240);
  }

  overlay.querySelector('#closeExpenseModal').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Eliminar gasto
  overlay.querySelectorAll('.del-expense-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const localIdx = parseInt(btn.dataset.idx);
      const target   = expenses[localIdx];
      await deleteExpense(year, target?.id, (await getExpenses(year)).findIndex(e => e === target || (e.month === target.month && e.description === target.description && e.amount === target.amount)));
      showToast('Gasto eliminado ✓');
      overlay.remove();
      openExpenseModal(month, year);
    });
  });

  // Guardar gasto
  overlay.querySelector('#saveExpenseBtn').addEventListener('click', async () => {
    const desc   = overlay.querySelector('#expenseDesc').value.trim();
    const amount = parseFloat(overlay.querySelector('#expenseAmount').value);
    if (!desc)                         { showToast('Ingresa una descripción.'); return; }
    if (isNaN(amount) || amount <= 0)  { showToast('Ingresa un monto válido.'); return; }
    await addExpense(year, month, desc, amount);
    showToast('Gasto registrado ✓');
    overlay.remove();
    openExpenseModal(month, year);
  });
}

function setupAccountingEvents() {
  document.getElementById('accountingYear')?.addEventListener('change', () => {
    const yearSel = document.getElementById('accountingYear');
    if (yearSel) yearSel.dataset.filled = '';
    renderAccountingSection().catch(console.error);
  });

  document.getElementById('addExpenseBtn')?.addEventListener('click', () => {
    const year  = parseInt(document.getElementById('accountingYear')?.value) || new Date().getFullYear();
    const month = new Date().getMonth();
    openExpenseModal(month, year);
  });

  document.getElementById('dailyBackBtn')?.addEventListener('click', () => {
    document.getElementById('accountingDailyView').style.display  = 'none';
    document.getElementById('accountingMonthlyView').style.display = '';
  });
}

// ─── Vista Diaria ─────────────────────────────────────────────────────────────

function getDailyStats(orders, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const filtered    = orders.filter(o => {
    const d = new Date(o.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day       = i + 1;
    const dayOrders = filtered.filter(o => new Date(o.date).getDate() === day);
    const paid      = dayOrders.filter(o => o.status === 'pagado');
    const cancelled = dayOrders.filter(o => o.status === 'cancelado');
    const revenue   = paid.reduce((s, o) => s + o.total, 0);
    return { day, orders: dayOrders.length, paid: paid.length, cancelled: cancelled.length, revenue };
  });
}

function renderDailyView(allOrders, year, month) {
  const dailyStats = getDailyStats(allOrders, year, month);
  const monthName  = MONTH_NAMES[month];
  const now        = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today      = now.getDate();

  // Cambiar vista
  document.getElementById('accountingMonthlyView').style.display = 'none';
  document.getElementById('accountingDailyView').style.display   = '';

  // Título
  document.getElementById('dailyViewTitle').textContent = `Días de ${monthName} ${year}`;

  // Resumen
  const bestDay      = dailyStats.reduce((b, d) => d.revenue > b.revenue ? d : b, dailyStats[0]);
  const totalRevenue = dailyStats.reduce((s, d) => s + d.revenue, 0);
  const totalPaid    = dailyStats.reduce((s, d) => s + d.paid, 0);
  const activeDays   = dailyStats.filter(d => d.revenue > 0).length;

  document.getElementById('dailySummary').innerHTML = [
    { label: `Total ${monthName}`, val: `S/ ${totalRevenue.toFixed(0)}`, sub: `${totalPaid} pedidos pagados`, color: 'var(--gold)' },
    { label: 'Mejor Día',         val: bestDay.revenue > 0 ? `Día ${bestDay.day}` : '—', sub: bestDay.revenue > 0 ? `S/ ${bestDay.revenue.toFixed(0)}` : 'Sin ventas aún', color: 'var(--green)' },
    { label: 'Días con Ventas',   val: String(activeDays || 0), sub: `de ${dailyStats.length} días del mes`, color: 'var(--gold-d)' },
    { label: 'Prom / Día Activo', val: activeDays > 0 ? `S/ ${(totalRevenue / activeDays).toFixed(0)}` : '—', sub: 'promedio días con venta', color: 'var(--text2)' },
  ].map(c => `
    <div class="stat-card" style="text-align:left;padding:1rem 1.1rem">
      <div class="stat-label" style="margin-bottom:.35rem">${c.label}</div>
      <div class="stat-val" style="color:${c.color};font-size:1.25rem;line-height:1.2">${c.val}</div>
      <div style="font-size:.7rem;color:var(--text3);margin-top:.3rem">${c.sub}</div>
    </div>`).join('');

  // Gráfico
  setTimeout(() => drawDailyChart(dailyStats, year, month), 0);

  // Tabla
  const tbody    = document.getElementById('dailyTableBody');
  const bestRev  = Math.max(...dailyStats.map(d => d.revenue));
  const activeDaysList = dailyStats.filter(d => d.orders > 0);

  if (activeDaysList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:2rem">Sin ventas registradas en este mes</td></tr>';
    return;
  }

  tbody.innerHTML = activeDaysList.map(d => {
    const isBest  = d.revenue > 0 && d.revenue === bestRev;
    const isToday = isCurrentMonth && d.day === today;
    return `
    <tr style="${isToday ? 'background:rgba(201,168,76,.06)' : ''}">
      <td>
        <span style="font-weight:700;color:${isToday ? 'var(--gold)' : 'var(--text)'}">
          ${d.day} de ${monthName}
        </span>
        ${isBest ? '&nbsp;<span style="font-size:.68rem;background:rgba(76,175,80,.15);color:#4caf50;padding:.1rem .45rem;border-radius:3px;font-weight:600">⭐ mejor</span>' : ''}
        ${isToday ? '&nbsp;<span style="font-size:.66rem;color:var(--gold-d)">(hoy)</span>' : ''}
      </td>
      <td style="text-align:center;color:var(--text2)">${d.paid || '—'}</td>
      <td style="text-align:center;color:${d.cancelled ? '#ef5350' : 'var(--text3)'}">${d.cancelled || '—'}</td>
      <td style="text-align:right;font-weight:600;color:${d.revenue > 0 ? 'var(--green)' : 'var(--text3)'}">
        ${d.revenue > 0 ? `S/ ${d.revenue.toFixed(2)}` : '—'}
      </td>
    </tr>`;
  }).join('');

  // Fila total
  tbody.innerHTML += `
    <tr style="background:var(--bg2);border-top:2px solid var(--border)">
      <td style="font-weight:700;color:var(--text);font-size:.85rem">TOTAL ${monthName}</td>
      <td style="text-align:center;font-weight:700;color:var(--gold)">${totalPaid}</td>
      <td style="text-align:center;font-weight:700;color:#ef5350">${dailyStats.reduce((s,d)=>s+d.cancelled,0) || '—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--green)">S/ ${totalRevenue.toFixed(2)}</td>
    </tr>`;
}

function drawDailyChart(dailyStats, year, month) {
  const canvas = document.getElementById('dailyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.parentElement.offsetWidth - 48;
  if (W <= 0) return;
  const H   = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const padL = 52, padR = 8, padT = 22, padB = 38;
  const cW     = W - padL - padR;
  const cH     = H - padT - padB;
  const n      = dailyStats.length;
  const maxRev = Math.max(...dailyStats.map(d => d.revenue), 1);
  const barW   = cW / n;
  const barGap = barW * 0.3;
  const bw     = barW - barGap;

  ctx.clearRect(0, 0, W, H);

  // Grid + etiquetas Y
  for (let i = 0; i <= 4; i++) {
    const y   = padT + cH - cH * i / 4;
    const val = Math.round(maxRev * i / 4);
    ctx.font      = '10px Inter, sans-serif';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText(`S/${val}`, padL - 5, y + 4);
    ctx.beginPath();
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth   = 0.8;
    ctx.moveTo(padL, y); ctx.lineTo(padL + cW, y);
    ctx.stroke();
  }

  const now        = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today      = now.getDate();
  const bestRev    = Math.max(...dailyStats.map(d => d.revenue));

  dailyStats.forEach((d, i) => {
    const x    = padL + i * barW + barGap / 2;
    const barH = (d.revenue / maxRev) * cH;
    const y    = padT + cH - barH;

    const isBest  = d.revenue > 0 && d.revenue === bestRev;
    const isToday = isCurrentMonth && d.day === today;

    if (d.revenue === 0) {
      ctx.fillStyle = '#252525';
      ctx.fillRect(x, padT + cH - 2, bw, 2);
    } else {
      const grad = ctx.createLinearGradient(0, y, 0, padT + cH);
      if (isBest) {
        grad.addColorStop(0, '#c9a84c'); grad.addColorStop(1, '#7a5c1e');
      } else if (isToday) {
        grad.addColorStop(0, '#4da6ff'); grad.addColorStop(1, '#1a4a7a');
      } else {
        grad.addColorStop(0, '#5a5a5a'); grad.addColorStop(1, '#2a2a2a');
      }
      ctx.fillStyle = grad;
      const r = Math.min(3, bw / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, padT + cH);
      ctx.lineTo(x, padT + cH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      if (barH > 14 && bw > 10) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.font      = '8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${d.revenue.toFixed(0)}`, x + bw / 2, y - 4);
      }
    }

    // Etiqueta día — mostrar todos si hay espacio, si no cada 5
    const showLabel = bw >= 10 || d.day === 1 || d.day % 5 === 0 || d.day === n;
    if (showLabel) {
      ctx.fillStyle = isToday ? '#c9a84c' : isBest ? '#c9a84c' : '#666';
      ctx.font      = `${(isToday || isBest) ? '700 ' : ''}${bw > 12 ? '9' : '8'}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${d.day}`, x + bw / 2, padT + cH + 14);
    }
  });
}

// ─── Sección: Estadísticas completas ─────────────────────────────────────────

let _statsCache = null;
let _statsCacheAt = 0;

// ── Chart helpers para Estadísticas ─────────────────────────────────────────

function _chartSetup(id, w, h) {
  const c = document.getElementById(id);
  if (!c) return null;
  const dpr = window.devicePixelRatio || 1;
  const pw  = c.parentElement ? (c.parentElement.offsetWidth - 24) : w;
  const cw  = Math.max(pw, 80);
  c.width  = cw * dpr; c.height = h * dpr;
  c.style.width = cw + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cw, h);
  return { ctx, W: cw, H: h };
}

function _drawTrendChart(id, months) {
  const r = _chartSetup(id, 300, 130);
  if (!r) return;
  const { ctx, W, H } = r;
  const maxRev = Math.max(...months.map(m => m.rev), 1);
  const padL = 44, padB = 24, padT = 12, padR = 8;
  const cW = W - padL - padR, cH = H - padT - padB;
  const n  = months.length;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = padT + cH - cH * i / 4;
    ctx.fillStyle = '#555'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`S/${Math.round(maxRev * i / 4)}`, padL - 4, y + 3);
    ctx.beginPath(); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = .7;
    ctx.moveTo(padL, y); ctx.lineTo(padL + cW, y); ctx.stroke();
  }

  // Area gradient
  const pts = months.map((m, i) => ({
    x: padL + i * (cW / (n - 1)),
    y: padT + cH - (m.rev / maxRev) * cH
  }));

  const grad = ctx.createLinearGradient(0, padT, 0, padT + cH);
  grad.addColorStop(0, 'rgba(201,168,76,.35)');
  grad.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, padT + cH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, padT + cH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 2; ctx.stroke();

  // Dots + labels
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a84c'; ctx.fill();
    ctx.fillStyle = '#888'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(months[i].label, p.x, H - 5);
    if (months[i].rev > 0) {
      ctx.fillStyle = '#c9a84c'; ctx.font = 'bold 8px sans-serif';
      ctx.fillText(`${months[i].rev.toFixed(0)}`, p.x, p.y - 7);
    }
  });
}

function _drawPayDonut(id, nEfect, nYape, nSin, total) {
  const size = 110;
  const c = document.getElementById(id);
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = c.height = size * dpr;
  c.style.width = c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const segs = [
    { v: nEfect, col: '#4caf50' },
    { v: nYape,  col: '#7c3aed' },
    { v: nSin,   col: '#3a3a3a' }
  ].filter(s => s.v > 0);
  const tot = segs.reduce((s, x) => s + x.v, 0) || 1;

  const cx = size / 2, cy = size / 2, R = size * .42, ri = size * .24;
  let angle = -Math.PI / 2;
  segs.forEach(seg => {
    const sweep = (seg.v / tot) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = seg.col; ctx.fill();
    angle += sweep;
  });

  // Hole
  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#1a1a1a';
  ctx.fill();

  // Center text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9a84c'; ctx.font = `bold ${size * .15}px sans-serif`;
  ctx.fillText(total, cx, cy - 7);
  ctx.fillStyle = '#888'; ctx.font = `${size * .09}px sans-serif`;
  ctx.fillText('pagados', cx, cy + 9);
}

function _drawTopHBar(id, items) {
  if (!items.length) return;
  const ROW = 26, PAD_T = 4;
  const r = _chartSetup(id, 300, items.length * ROW + PAD_T * 2);
  if (!r) return;
  const { ctx, W, H } = r;
  const maxV  = items[0]?.qty || 1;
  const padL  = 120, padR = 48;
  const barW  = W - padL - padR;
  const GOLD  = '#c9a84c';
  const DARK  = '#2e2e2e';

  items.forEach((item, i) => {
    const y  = PAD_T + i * ROW;
    const pct = item.qty / maxV;
    const bw  = Math.max(pct * barW, 2);
    const clr = i === 0 ? GOLD : i === 1 ? '#9a7830' : i === 2 ? '#6a5020' : DARK;

    // Label
    const lbl = (item.brand ? item.brand + ' ' : '') + item.name;
    const short = lbl.length > 17 ? lbl.slice(0, 17) + '…' : lbl;
    ctx.fillStyle = '#aaa'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(short, padL - 5, y + 14);

    // Bar
    ctx.fillStyle = clr;
    const bh = 14, by = y + 5;
    ctx.beginPath();
    ctx.moveTo(padL, by); ctx.lineTo(padL + bw - 4, by);
    ctx.quadraticCurveTo(padL + bw, by, padL + bw, by + 4);
    ctx.lineTo(padL + bw, by + bh - 4);
    ctx.quadraticCurveTo(padL + bw, by + bh, padL + bw - 4, by + bh);
    ctx.lineTo(padL, by + bh); ctx.closePath(); ctx.fill();

    // Value
    ctx.fillStyle = '#ccc'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${item.qty} un.`, padL + bw + 4, y + 14);
  });
}
const STATS_TTL = 90000; // 90 s

async function renderStatsSection(forceRefresh = false) {
  const container = document.getElementById('statsContent');
  if (!container) return;

  const now = Date.now();
  const useCache = !forceRefresh && _statsCache && (now - _statsCacheAt) < STATS_TTL;

  if (!useCache) {
    container.innerHTML = `
      <div style="padding:1.5rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;margin-bottom:.8rem">
        ${[1,2,3,4].map(() => `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.8rem;height:56px;animation:statsSkeleton 1.2s ease infinite alternate"></div>`).join('')}
      </div>
      <style>@keyframes statsSkeleton{from{opacity:.4}to{opacity:.9}}</style>
      <p style="text-align:center;color:var(--text2);font-size:.8rem;padding:.5rem">Cargando datos…</p>`;
  }

  let orders, products;
  if (useCache) {
    ({ orders, products } = _statsCache);
  } else {
    try {
      [orders, products] = await Promise.all([CloudOrders.getAll(), CloudProducts.getAll()]);
      _statsCache   = { orders, products };
      _statsCacheAt = now;
    } catch (err) {
      console.error('Stats: error al cargar datos:', err);
      container.innerHTML = '<p style="color:var(--text2);text-align:center;padding:2rem">Error al cargar. Haz clic en "↻ Actualizar" para reintentar.</p>';
      return;
    }
  }

  if (!orders.length) {
    container.innerHTML = '<p style="color:var(--text2);text-align:center;padding:2.5rem">Aún no hay pedidos registrados.</p>';
    return;
  }

  // ── Lookup de productos ─────────────────────────────────────────────────
  const prodLookup = {};
  products.forEach(p => { prodLookup[p.id] = p; });

  // ── KPIs ────────────────────────────────────────────────────────────────
  const paidOrders    = orders.filter(o => o.status === 'pagado');
  const totalRevenue  = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const avgTicket     = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const discountCount = orders.filter(o => (o.notes || '').includes('DESCUENTO')).length;

  // ── Top perfumes (decants) ───────────────────────────────────────────────
  const perfMap = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const k = item.productId ? String(item.productId) : (item.productName || '?');
      if (!perfMap[k]) perfMap[k] = { name: item.productName || k, brand: item.brand || '', qty: 0, rev: 0 };
      perfMap[k].qty += (item.quantity || 1);
      perfMap[k].rev += (item.price || 0) * (item.quantity || 1);
    });
  });
  const topPerf = Object.values(perfMap).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const maxPerf = topPerf[0]?.qty || 1;

  // ── Por género ────────────────────────────────────────────────────────────
  const gQty = { masculino: 0, femenino: 0, unisex: 0 };
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const p = prodLookup[item.productId];
      const g = (p?.gender || 'unisex').toLowerCase();
      if (gQty[g] !== undefined) gQty[g] += (item.quantity || 1);
      else gQty.unisex += (item.quantity || 1);
    });
  });
  const totalG = Math.max(gQty.masculino + gQty.femenino + gQty.unisex, 1);

  // ── Por tipo ──────────────────────────────────────────────────────────────
  const typeQty = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const p = prodLookup[item.productId];
      const t = p?.type || 'diseñador';
      typeQty[t] = (typeQty[t] || 0) + (item.quantity || 1);
    });
  });
  const totalT = Math.max(Object.values(typeQty).reduce((s, v) => s + v, 0), 1);

  // ── Por tamaño ────────────────────────────────────────────────────────────
  const sizeQty = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const sz = item.size || '?';
      sizeQty[sz] = (sizeQty[sz] || 0) + (item.quantity || 1);
    });
  });
  const topSizes  = Object.entries(sizeQty).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSize   = topSizes[0]?.[1] || 1;

  // ── Entrega ───────────────────────────────────────────────────────────────
  let cRecojo = 0, cEnvio = 0;
  orders.forEach(o => { o.deliveryType === 'envio' ? cEnvio++ : cRecojo++; });
  const totalDel = Math.max(cRecojo + cEnvio, 1);

  // ── Top departamentos ─────────────────────────────────────────────────────
  const deptMap = {};
  orders.filter(o => o.deliveryType === 'envio' && o.department).forEach(o => {
    deptMap[o.department] = (deptMap[o.department] || 0) + 1;
  });
  const topDepts = Object.entries(deptMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxDept  = topDepts[0]?.[1] || 1;

  // ── Top clientes ──────────────────────────────────────────────────────────
  const clientMap = {};
  orders.forEach(o => {
    const k = o.customerDni || o.customerName || '?';
    if (!clientMap[k]) clientMap[k] = { name: o.customerName || '—', dni: o.customerDni || '—', phone: o.customerPhone || '—', orders: 0, total: 0 };
    clientMap[k].orders++;
    clientMap[k].total += (o.total || 0);
    if (o.customerName)  clientMap[k].name  = o.customerName;
    if (o.customerPhone) clientMap[k].phone = o.customerPhone;
  });
  const topClients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 10);

  // ── Método de pago ─────────────────────────────────────────────────────────
  const pmEfectivo = paidOrders.filter(o => o.paymentMethod === 'efectivo');
  const pmYape     = paidOrders.filter(o => o.paymentMethod === 'yape');
  const pmSinDato  = paidOrders.filter(o => !o.paymentMethod);
  const revEfect   = pmEfectivo.reduce((s, o) => s + o.total, 0);
  const revYape    = pmYape.reduce((s, o) => s + o.total, 0);

  // ── Tendencia últimos 6 meses ──────────────────────────────────────────────
  const now6 = new Date();
  const trend6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now6.getFullYear(), now6.getMonth() - 5 + i, 1);
    const mo = paidOrders.filter(o => {
      const od = new Date(o.date);
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
    });
    return { label: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()], rev: mo.reduce((s,o) => s + o.total, 0) };
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const medal = i => ['🥇','🥈','🥉'][i] || `${i+1}`;

  const bar = (label, val, max, color = 'var(--gold)') => {
    const pct = Math.round(val / max * 100);
    return `<div style="margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:.18rem">
        <span style="color:var(--text2)">${label}</span>
        <span style="color:var(--text);font-weight:600">${val} <small style="color:var(--text3)">(${pct}%)</small></span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
      </div>
    </div>`;
  };

  const th = 'padding:.45rem .65rem;color:var(--text2);font-size:.72rem;font-weight:600;text-align:left;border-bottom:1px solid var(--border)';
  const td = 'padding:.45rem .65rem;font-size:.78rem;border-bottom:1px solid var(--border)';
  const tdr = td + ';text-align:right';

  container.innerHTML = `
    <style>
      .stats-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;padding:.75rem .75rem 0}
      .stats-kpis-2{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;padding:.4rem .75rem 0}
      .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;padding:.75rem}
      .stats-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;padding:0 .75rem .75rem}
      .kpi-box{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.65rem .8rem;position:relative;overflow:hidden}
      .kpi-box::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent 60%,rgba(255,255,255,.02));pointer-events:none}
      .kpi-v{font-size:1.25rem;font-weight:700;color:var(--gold);font-family:'Playfair Display',serif;line-height:1.1}
      .kpi-l{font-size:.63rem;color:var(--text2);margin-top:.2rem;letter-spacing:.03em}
      .kpi-sub{font-size:.6rem;color:var(--text3);margin-top:.1rem}
      .stat-card-inner{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
      .stat-card-head{padding:.6rem .8rem;border-bottom:1px solid var(--border);font-size:.8rem;color:var(--gold);font-weight:600;display:flex;align-items:center;gap:.4rem}
      .stat-card-sub{font-size:.65rem;color:var(--text2);font-weight:400;margin-left:auto}
      .stat-card-body{padding:.6rem .8rem}
      .chart-legend{display:flex;flex-wrap:wrap;gap:.4rem .8rem;padding:.5rem .8rem .7rem;font-size:.72rem}
      .legend-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:.3rem;flex-shrink:0}
      @media(max-width:600px){
        .stats-kpis,.stats-kpis-2{grid-template-columns:1fr 1fr}
        .stats-grid{grid-template-columns:1fr}
        .stats-grid-3{grid-template-columns:1fr}
        .stats-kpis,.stats-kpis-2,.stats-grid,.stats-grid-3{padding:.5rem}
      }
    </style>

    <!-- Cabecera -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem .2rem;flex-wrap:wrap;gap:.4rem">
      <span style="font-size:.72rem;color:var(--text3)">Caché 90s · ${orders.length} pedidos · ${products.length} productos</span>
      <button onclick="renderStatsSection(true)" style="font-size:.7rem;padding:.28rem .7rem;background:transparent;border:1px solid var(--border);border-radius:var(--r);color:var(--text2);cursor:pointer;display:flex;align-items:center;gap:.3rem">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        Actualizar
      </button>
    </div>

    <!-- KPIs fila 1 -->
    <div class="stats-kpis">
      <div class="kpi-box">
        <div class="kpi-v">${orders.length}</div>
        <div class="kpi-l">Total pedidos</div>
        <div class="kpi-sub">${paidOrders.length} pagados · ${orders.filter(o=>o.status==='pendiente').length} pendientes</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-v" style="color:#4caf50">S/ ${totalRevenue.toFixed(0)}</div>
        <div class="kpi-l">Facturado (pagados)</div>
        <div class="kpi-sub">Ticket prom. S/ ${avgTicket.toFixed(1)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-v" style="color:var(--text2)">${products.filter(p=>p.inStock).length}<span style="font-size:.75rem;color:var(--text3)">/${products.length}</span></div>
        <div class="kpi-l">Productos en stock</div>
        <div class="kpi-sub">${products.filter(p=>!p.inStock).length} agotados</div>
      </div>
    </div>

    <!-- KPIs fila 2: métodos de pago -->
    <div class="stats-kpis-2">
      <div class="kpi-box" style="border-color:rgba(76,175,80,.3)">
        <div class="kpi-v" style="color:#4caf50">S/ ${revEfect.toFixed(0)}</div>
        <div class="kpi-l">💵 Efectivo</div>
        <div class="kpi-sub">${pmEfectivo.length} pedido${pmEfectivo.length!==1?'s':''}</div>
      </div>
      <div class="kpi-box" style="border-color:rgba(124,58,237,.3)">
        <div class="kpi-v" style="color:#a78bfa">S/ ${revYape.toFixed(0)}</div>
        <div class="kpi-l">📱 Yape</div>
        <div class="kpi-sub">${pmYape.length} pedido${pmYape.length!==1?'s':''}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-v" style="color:var(--text2)">S/ ${pmSinDato.reduce((s,o)=>s+o.total,0).toFixed(0)}</div>
        <div class="kpi-l">⏳ Sin dato de pago</div>
        <div class="kpi-sub">${pmSinDato.length} pedido${pmSinDato.length!==1?'s':''}</div>
      </div>
    </div>

    <!-- Chart: Tendencia 6 meses + Métodos de pago -->
    <div class="stats-grid">
      <div class="stat-card-inner">
        <div class="stat-card-head">📈 Tendencia de ventas <span class="stat-card-sub">últimos 6 meses</span></div>
        <div style="padding:.75rem"><canvas id="statsTrendChart" style="display:block;width:100%;height:130px"></canvas></div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">💳 Método de pago <span class="stat-card-sub">pedidos pagados</span></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:1rem;padding:.75rem;flex-wrap:wrap">
          <canvas id="statsPayChart" style="flex-shrink:0"></canvas>
          <div class="chart-legend" style="flex-direction:column;padding:0;gap:.5rem">
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem"><span class="legend-dot" style="background:#4caf50"></span>💵 Efectivo: <strong>${pmEfectivo.length}</strong></div>
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem"><span class="legend-dot" style="background:#7c3aed"></span>📱 Yape: <strong>${pmYape.length}</strong></div>
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem"><span class="legend-dot" style="background:#444"></span>Sin dato: <strong>${pmSinDato.length}</strong></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top decants (chart horizontal) + clientes -->
    <div class="stats-grid">
      <div class="stat-card-inner">
        <div class="stat-card-head">🏆 Top decants <span class="stat-card-sub">por unidades vendidas</span></div>
        <div style="padding:.75rem .5rem"><canvas id="statsTopChart" style="display:block;width:100%"></canvas></div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">⭐ Mejores clientes<span class="stat-card-sub">por total gastado</span></div>
        <div class="stat-card-body" style="padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="${th}">#</th><th style="${th}">Cliente</th>
              <th style="${th};text-align:right">Ped.</th><th style="${th};text-align:right">S/</th>
            </tr></thead>
            <tbody>${topClients.map((c,i) => `<tr>
              <td style="${td};font-size:.85rem">${medal(i)}</td>
              <td style="${td}"><strong style="font-size:.76rem;display:block">${sanitize(c.name)}</strong><small style="color:var(--text2);font-size:.68rem">DNI: ••••${sanitize(c.dni).slice(-4)}</small></td>
              <td style="${tdr};color:var(--gold);font-weight:700">${c.orders}</td>
              <td style="${tdr}">S/${c.total.toFixed(0)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Fila de 3: género, tipo, tamaños -->
    <div class="stats-grid-3">
      <div class="stat-card-inner">
        <div class="stat-card-head">👥 Por género</div>
        <div class="stat-card-body">
          ${bar('👨 Hombre', gQty.masculino, totalG, '#5b9cf6')}
          ${bar('👩 Mujer',  gQty.femenino,  totalG, '#f06292')}
          ${bar('✨ Unisex', gQty.unisex,    totalG, 'var(--gold)')}
        </div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">🧴 Tipo fragancia</div>
        <div class="stat-card-body">
          ${Object.entries(typeQty).sort((a,b)=>b[1]-a[1]).map(([t,v]) => {
            const clr = { arabe:'#a78bfa', entero:'#34d399' };
            return bar(t.charAt(0).toUpperCase()+t.slice(1), v, totalT, clr[t]||'var(--gold)');
          }).join('')}
        </div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">💧 Tamaño decant</div>
        <div class="stat-card-body">
          ${topSizes.map(([sz,v]) => bar(sz, v, maxSize)).join('') || '<p style="color:var(--text2);font-size:.78rem">Sin datos</p>'}
        </div>
      </div>
    </div>

    <!-- Fila de 2: entrega + departamentos -->
    <div class="stats-grid" style="padding-top:0">
      <div class="stat-card-inner">
        <div class="stat-card-head">🚚 Método de entrega</div>
        <div class="stat-card-body">
          ${bar('🏪 Recojo en tienda', cRecojo, totalDel, 'var(--gold)')}
          ${bar('📦 Envío Shalom', cEnvio, totalDel, '#60a5fa')}
        </div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">📍 Envíos por región</div>
        <div class="stat-card-body">
          ${topDepts.length ? topDepts.map(([d,v]) => bar(d,v,maxDept)).join('') : '<p style="color:var(--text2);font-size:.78rem;text-align:center">Sin envíos aún</p>'}
        </div>
      </div>
    </div>`;

  // ── Dibujar gráficos después del render ──────────────────────────────────
  setTimeout(() => {
    _drawTrendChart('statsTrendChart', trend6);
    _drawPayDonut('statsPayChart', pmEfectivo.length, pmYape.length, pmSinDato.length, paidOrders.length);
    _drawTopHBar('statsTopChart', topPerf.slice(0, 8));
  }, 60);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DASHBOARD / INICIO ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function renderDashboard() {
  const el = document.getElementById('dashboardContent');
  if (!el) return;

  // Fecha y hora actual
  const dateEl = document.getElementById('dashboardDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Skeleton mientras carga
  el.innerHTML = `
    <div class="dash-skeleton-wrap">
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
    </div>`;

  const [orders, products] = await Promise.all([
    CloudOrders.getAll().catch(() => []),
    CloudProducts.getAll().catch(() => [])
  ]);

  const today     = new Date().toDateString();
  const todayOrds = orders.filter(o => new Date(o.date).toDateString() === today);
  const pending   = orders.filter(o => o.status === 'pendiente');
  const weekAgo   = Date.now() - 7 * 24 * 3600 * 1000;
  const weekRevenue = orders
    .filter(o => o.status === 'pagado' && new Date(o.date).getTime() > weekAgo)
    .reduce((s, o) => s + o.total, 0);

  // Stock bajo: decants con < 15ml restantes o enteros con stockQuantity < 2
  const lowStock = products.filter(p => {
    if (!p.inStock) return false;
    if (p.type === 'entero') return (p.stockQuantity || 0) <= 1;
    return p.bottleTotalMl > 0 && (p.bottleRemainingMl || 0) > 0 && (p.bottleRemainingMl || 0) < 15;
  });

  // Últimos 5 pedidos
  const recent = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const STATUS_COLORS = { pendiente: 'var(--orange)', pagado: 'var(--green)', cancelado: 'var(--red)', enviado: '#64b5f6', entregado: 'var(--gold)' };
  const STATUS_LABELS_D = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };

  el.innerHTML = `
    <!-- KPIs -->
    <div class="dash-kpi-grid">
      <div class="dash-kpi">
        <div class="dash-kpi-icon" style="background:rgba(201,168,76,.12);color:var(--gold)">📦</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">${todayOrds.length}</div>
          <div class="dash-kpi-lbl">Pedidos hoy</div>
        </div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-icon" style="background:rgba(76,175,80,.1);color:var(--green)">💰</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">S/ ${weekRevenue.toFixed(0)}</div>
          <div class="dash-kpi-lbl">Ingresos esta semana</div>
        </div>
      </div>
      <div class="dash-kpi ${pending.length > 0 ? 'dash-kpi-warn' : ''}">
        <div class="dash-kpi-icon" style="background:rgba(255,152,0,.1);color:var(--orange)">⏳</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">${pending.length}</div>
          <div class="dash-kpi-lbl">Por confirmar</div>
        </div>
      </div>
      <div class="dash-kpi ${lowStock.length > 0 ? 'dash-kpi-alert' : ''}">
        <div class="dash-kpi-icon" style="background:rgba(239,83,80,.1);color:var(--red)">⚠</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">${lowStock.length}</div>
          <div class="dash-kpi-lbl">Stock bajo</div>
        </div>
      </div>
    </div>

    <div class="dash-two-col">
      <!-- Últimos pedidos -->
      <div class="dash-panel">
        <div class="dash-panel-head">
          <span>Últimos pedidos</span>
          <button class="dash-panel-link" onclick="document.querySelector('[data-section=orders]').click()">Ver todos →</button>
        </div>
        <div class="dash-panel-body">
          ${recent.length === 0
            ? `<p style="text-align:center;color:var(--text2);padding:1.5rem;font-size:.82rem">No hay pedidos aún</p>`
            : recent.map(o => `
            <div class="dash-order-row">
              <div>
                <div class="dash-order-id">${sanitize(o.id)}</div>
                <div class="dash-order-client">${sanitize(o.customerName || '—')}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--gold);font-size:.85rem">S/ ${o.total.toFixed(2)}</div>
                <span style="font-size:.68rem;font-weight:600;color:${STATUS_COLORS[o.status] || 'var(--text2)'}">${STATUS_LABELS_D[o.status] || o.status}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Alertas de stock bajo -->
      <div class="dash-panel">
        <div class="dash-panel-head">
          <span>⚠ Stock bajo</span>
          <button class="dash-panel-link" onclick="document.querySelector('[data-section=products]').click()">Ver perfumes →</button>
        </div>
        <div class="dash-panel-body">
          ${lowStock.length === 0
            ? `<p style="text-align:center;color:var(--green);padding:1.5rem;font-size:.82rem">✓ Todo el stock está bien</p>`
            : lowStock.slice(0, 8).map(p => {
                const detail = p.type === 'entero'
                  ? `${p.stockQuantity || 0} und.`
                  : `~${Math.round(p.bottleRemainingMl || 0)}ml`;
                return `
                <div class="dash-stock-row">
                  <div class="dash-stock-info">
                    <div class="dash-stock-name">${sanitize(p.brand)} — ${sanitize(p.name)}</div>
                    <div class="dash-stock-detail">${detail} restantes</div>
                  </div>
                  <span class="dash-stock-badge">${detail}</span>
                </div>`;
              }).join('')}
        </div>
      </div>
    </div>

    <!-- Acciones rápidas -->
    <div class="dash-actions">
      <button class="dash-action-btn" onclick="document.querySelector('[data-section=orders]').click();setTimeout(()=>document.getElementById('registerOrderBtn')?.click(),300)">
        <span>📝</span> Registrar pedido
      </button>
      <button class="dash-action-btn" onclick="document.querySelector('[data-section=products]').click();setTimeout(()=>document.getElementById('addProductBtn')?.click(),300)">
        <span>✦</span> Agregar perfume
      </button>
      <button class="dash-action-btn" onclick="exportCatalogPDF()">
        <span>📄</span> Exportar catálogo PDF
      </button>
      <button class="dash-action-btn" onclick="document.querySelector('[data-section=accounting]').click()">
        <span>💳</span> Ver contabilidad
      </button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CONTROL DE PRECIOS ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let _preciosSearch     = '';
let _preciosTypeFilter = 'all';

async function _setCostPrice(productId, price) {
  await CloudProducts.update(parseInt(productId), { costPrice: price });
}

function _preciosMarginColor(pct) {
  if (pct >= 50) return '#4caf50';
  if (pct >= 25) return '#ff9800';
  return '#ef5350';
}

async function renderPreciosSection() {
  const container = document.getElementById('preciosContent');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;color:var(--text2);padding:2.5rem;font-size:.85rem">Cargando perfumes…</div>`;

  let products = [];
  try {
    products = await withTimeout(CloudProducts.getAll(), 15000, 'los precios');
  } catch (err) {
    container.innerHTML = `<div style="text-align:center;color:#ef5350;padding:2rem">No se pudieron cargar los perfumes. Recarga la página.</div>`;
    return;
  }

  if (_preciosTypeFilter === 'entero') {
    products = products.filter(p => p.type === 'entero');
  } else if (_preciosTypeFilter === 'decant') {
    products = products.filter(p => p.type !== 'entero');
  }

  if (_preciosSearch) {
    const q = _preciosSearch.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.olfFamily || '').toLowerCase().includes(q)
    );
  }

  if (!products.length) {
    container.innerHTML = `<div style="text-align:center;color:var(--text2);padding:2.5rem">No hay perfumes que coincidan.</div>`;
    return;
  }

  // ── Resumen global ──────────────────────────────────────────────────────────
  const totalWithCost = products.filter(p => (p.costPrice || 0) > 0).length;
  const totalSinCosto = products.length - totalWithCost;

  const summaryHtml = `
    <div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-bottom:1.25rem">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.65rem 1.1rem;min-width:110px">
        <div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.2rem">Total</div>
        <div style="font-size:1.3rem;font-weight:700;color:var(--gold)">${products.length}</div>
      </div>
      <div style="background:var(--card);border:1px solid rgba(76,175,80,.3);border-radius:var(--r);padding:.65rem 1.1rem;min-width:110px">
        <div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.2rem">Con costo</div>
        <div style="font-size:1.3rem;font-weight:700;color:#4caf50">${totalWithCost}</div>
      </div>
      ${totalSinCosto > 0 ? `
      <div style="background:var(--card);border:1px solid rgba(239,83,80,.25);border-radius:var(--r);padding:.65rem 1.1rem;min-width:110px">
        <div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.2rem">Sin costo</div>
        <div style="font-size:1.3rem;font-weight:700;color:#ef5350">${totalSinCosto}</div>
      </div>` : ''}
    </div>`;

  // ── Tabla encabezado ────────────────────────────────────────────────────────
  const headerHtml = `
    <div class="precios-table-header" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:1rem;padding:.5rem 1rem;margin-bottom:.35rem;border-radius:var(--r)">
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600">Perfume</div>
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;text-align:right">Costo entrada (S/)</div>
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;text-align:right">Precio venta (S/)</div>
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;text-align:right">Ganancia / Margen</div>
    </div>`;

  // ── Filas de productos ──────────────────────────────────────────────────────
  const rowsHtml = products.map(p => {
    const isEntero   = p.type === 'entero';
    const costPrice  = parseFloat(p.costPrice || 0);
    const typeLabel  = p.type === 'arabe' ? 'Árabe' : p.type === 'entero' ? 'Entero' : 'Diseñador';
    const typeBadge  = p.type === 'arabe' ? 'badge-arabe' : p.type === 'entero' ? 'badge-entero' : 'badge-dis';
    const adminImg   = _normAdminImg(p.imageUrl) || buildProductImage(p);
    const hasCost    = costPrice > 0;

    // ── Columna "Precio venta" y "Ganancia" ──────────────────────────────────
    let salePricesHtml = '';
    let gananciaHtml   = '';

    if (isEntero) {
      const salePrice = parseFloat(p.enteroPrice || 0);
      const ganancia  = hasCost && salePrice > 0 ? salePrice - costPrice : null;
      const margin    = ganancia !== null && salePrice > 0 ? (ganancia / salePrice * 100) : null;

      salePricesHtml = salePrice > 0
        ? `<span style="font-size:1rem;font-weight:700;color:var(--gold)">S/ ${salePrice.toFixed(2)}</span><div style="font-size:.7rem;color:var(--text3);margin-top:.1rem">Precio entero</div>`
        : `<span style="color:var(--text3);font-size:.82rem">Sin precio asignado</span>`;

      if (ganancia !== null) {
        const gColor = _preciosMarginColor(margin);
        gananciaHtml = `
          <div style="display:flex;flex-direction:column;gap:.15rem;align-items:flex-end">
            <span style="font-size:1rem;font-weight:700;color:${gColor}">${ganancia >= 0 ? '+' : ''}S/ ${ganancia.toFixed(2)}</span>
            <span style="font-size:.76rem;padding:.15rem .5rem;border-radius:20px;background:${gColor}22;color:${gColor};font-weight:700">${margin.toFixed(1)}%</span>
          </div>`;
      } else {
        gananciaHtml = `<span style="color:var(--text3);font-size:.78rem">${hasCost ? 'Sin precio venta' : 'Ingresa el costo'}</span>`;
      }
    } else {
      // Decants — mostrar una fila por talla
      const costPerMl  = hasCost && p.bottleTotalMl > 0 ? costPrice / p.bottleTotalMl : 0;
      const sizes      = Object.entries(p.sizes || {});
      const hasBottle  = p.bottleTotalMl > 0;

      if (!sizes.length) {
        salePricesHtml = `<span style="color:var(--text3);font-size:.78rem">Sin tallas</span>`;
        gananciaHtml   = `<span style="color:var(--text3);font-size:.78rem">—</span>`;
      } else {
        salePricesHtml = `
          <div style="display:flex;flex-direction:column;gap:.25rem">
            ${sizes.map(([ml, price]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.2rem .4rem;background:var(--bg2);border-radius:4px">
              <span style="font-size:.73rem;color:var(--text2);white-space:nowrap;min-width:32px">${sanitize(ml)}</span>
              <span style="font-size:.88rem;font-weight:700;color:var(--gold)">S/${parseFloat(price).toFixed(2)}</span>
            </div>`).join('')}
          </div>`;

        gananciaHtml = `
          <div style="display:flex;flex-direction:column;gap:.25rem">
            ${sizes.map(([ml, price]) => {
              const mlNum   = parseFloat(ml);
              const saleP   = parseFloat(price);
              if (!costPerMl || isNaN(mlNum) || !hasBottle) {
                return `<div style="height:32px;display:flex;align-items:center;justify-content:flex-end;padding:.2rem .4rem"><span style="color:var(--text3);font-size:.73rem">${!hasCost ? '—' : 'Sin botella'}</span></div>`;
              }
              const mlCost  = costPerMl * mlNum;
              const gan     = saleP - mlCost;
              const margin  = saleP > 0 ? (gan / saleP * 100) : 0;
              const gColor  = _preciosMarginColor(margin);
              return `
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:.35rem;padding:.2rem .4rem;background:var(--bg2);border-radius:4px">
                  <span style="font-size:.8rem;font-weight:700;color:${gColor}">${gan >= 0 ? '+' : ''}S/${gan.toFixed(2)}</span>
                  <span style="font-size:.68rem;padding:.1rem .38rem;border-radius:12px;background:${gColor}22;color:${gColor};font-weight:700;white-space:nowrap">${margin.toFixed(0)}%</span>
                </div>`;
            }).join('')}
          </div>`;
      }

      // Nota de frasco si no está configurado
      if (!hasBottle && hasCost) {
        gananciaHtml += `<div style="font-size:.68rem;color:var(--text3);margin-top:.25rem">⚠ Sin ml de frasco configurados</div>`;
      }
    }

    return `
    <div class="admin-card precios-product-row" data-id="${p.id}"
         style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:1rem;align-items:start;padding:1rem 1.1rem;margin-bottom:.5rem;transition:border-color .2s"
         onmouseenter="this.style.borderColor='rgba(201,168,76,.25)'" onmouseleave="this.style.borderColor=''">

      <!-- Col 1: Perfume info -->
      <div style="display:flex;gap:.75rem;align-items:flex-start;min-width:0">
        <img src="${escapeAttr(adminImg)}" alt="" loading="lazy"
             style="width:48px;height:48px;object-fit:contain;border-radius:var(--r);background:var(--bg2);flex-shrink:0"
             onerror="this.style.display='none'">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-bottom:.25rem">
            <span class="admin-type-badge ${typeBadge}" style="font-size:.63rem">${typeLabel}</span>
            ${!hasCost ? '<span style="font-size:.62rem;background:rgba(239,83,80,.14);color:#ef5350;border:1px solid rgba(239,83,80,.3);border-radius:10px;padding:.1rem .45rem;font-weight:600">Sin costo</span>' : ''}
          </div>
          <h3 style="font-size:.82rem;font-weight:600;color:var(--white);margin:0 0 .15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(p.brand)}</h3>
          <p style="font-size:.76rem;color:var(--text2);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(p.name)}</p>
          ${!isEntero && p.bottleTotalMl > 0 ? `<p style="font-size:.68rem;color:var(--text3);margin:.15rem 0 0">Frasco: ${p.bottleTotalMl} ml</p>` : ''}
        </div>
      </div>

      <!-- Col 2: Costo entrada -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.35rem">
        <div style="display:flex;align-items:center;gap:.3rem">
          <span style="font-size:.78rem;color:var(--text3)">S/</span>
          <input type="number" class="cost-price-input" data-id="${p.id}"
                 value="${hasCost ? costPrice.toFixed(2) : ''}"
                 min="0" max="99999" step="0.5"
                 placeholder="0.00"
                 style="width:82px;background:var(--bg2);border:1px solid var(--border-l);border-radius:var(--r);color:var(--text);font-size:.9rem;font-weight:700;padding:.32rem .5rem;outline:none;text-align:right;transition:border-color .15s"
                 onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border-l)'">
        </div>
        <button class="btn-save-cost" data-id="${p.id}"
                style="font-size:.72rem;padding:.3rem .8rem;background:rgba(201,168,76,.12);color:var(--gold-d);border:1px solid rgba(201,168,76,.3);border-radius:var(--r);cursor:pointer;font-weight:700;white-space:nowrap;transition:background .15s"
                onmouseover="this.style.background='rgba(201,168,76,.24)'" onmouseout="this.style.background='rgba(201,168,76,.12)'">
          Guardar costo
        </button>
        ${isEntero && !hasCost ? '' : !isEntero && p.bottleTotalMl > 0 && hasCost ? `<div style="font-size:.68rem;color:var(--text3);text-align:right">S/${(costPrice/p.bottleTotalMl).toFixed(3)}/ml</div>` : ''}
      </div>

      <!-- Col 3: Precio venta -->
      <div style="display:flex;flex-direction:column;align-items:flex-end">
        ${salePricesHtml}
      </div>

      <!-- Col 4: Ganancia / Margen -->
      <div style="display:flex;flex-direction:column;align-items:flex-end">
        ${gananciaHtml}
      </div>

    </div>`;
  }).join('');

  container.innerHTML = summaryHtml + headerHtml + `<div id="preciosRowsWrap">${rowsHtml}</div>`;

  // ── Eventos: guardar costo ─────────────────────────────────────────────────
  container.querySelectorAll('.btn-save-cost').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id    = btn.dataset.id;
      const row   = btn.closest('.precios-product-row');
      const inp   = row?.querySelector('.cost-price-input');
      const price = parseFloat(inp?.value);
      if (isNaN(price) || price < 0) { showToast('Ingresa un precio válido (mayor a 0).'); return; }
      btn.disabled    = true;
      btn.textContent = 'Guardando…';
      try {
        await _setCostPrice(id, price);
        showToast('Precio de entrada guardado en base de datos ✓');
        await renderPreciosSection();
      } catch (err) {
        console.error('[MICHT] Error guardando cost_price:', err);
        showToast('Error al guardar. Verifica la conexión.');
        btn.disabled    = false;
        btn.textContent = 'Guardar costo';
      }
    });
  });
}

function setupPreciosEvents() {
  const search = document.getElementById('preciosSearch');
  if (search && !search._bound) {
    search._bound = true;
    search.addEventListener('input', function () {
      _preciosSearch = this.value.trim();
      renderPreciosSection().catch(console.error);
    });
  }

  document.querySelectorAll('.precios-filter-btn').forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.precios-filter-btn').forEach(b => {
        b.style.background = 'var(--bg2)';
        b.style.color      = 'var(--text2)';
        b.classList.remove('active');
      });
      btn.style.background = 'var(--gold)';
      btn.style.color      = '#111';
      btn.classList.add('active');
      _preciosTypeFilter = btn.dataset.ptype;
      renderPreciosSection().catch(console.error);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── HERRAMIENTAS ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function setupToolsSection() {
  setupPriceCalculator();
  setupCsvExport();
  await setupWhatsAppTool();
}

// ── Calculadora de precios ────────────────────────────────────────────────────

function setupPriceCalculator() {
  const btn = document.getElementById('calcBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;

  const priceInput = document.getElementById('calcBottlePrice');
  const mlInput    = document.getElementById('calcBottleMl');
  const marginInput = document.getElementById('calcMargin');
  const result      = document.getElementById('calcResult');

  function calculate() {
    const bottlePrice = parseFloat(priceInput.value);
    const bottleMl    = parseFloat(mlInput.value);
    const marginVal   = parseFloat(marginInput.value);
    const margin      = isNaN(marginVal) ? 0.8 : marginVal / 100;

    if (isNaN(bottlePrice) || isNaN(bottleMl) || bottleMl <= 0 || bottlePrice <= 0) {
      result.style.display = 'none';
      return false;
    }

    const costPerMl = bottlePrice / bottleMl;
    const sizes = [3, 5, 10, 15, 20];

    result.style.display = 'block';
    result.innerHTML = `
      <div class="calc-result-header">
        <span>Costo por ml: <strong>S/ ${costPerMl.toFixed(3)}</strong></span>
        <span style="color:var(--text2)">Margen: ${Math.round(margin * 100)}%</span>
      </div>
      <div class="calc-sizes-grid">
        ${sizes.map(ml => {
          const cost = costPerMl * ml;
          const price = cost * (1 + margin);
          const rounded = Math.ceil(price / 0.5) * 0.5;
          return `
          <div class="calc-size-card">
            <div class="calc-size-ml">${ml}ml</div>
            <div class="calc-size-cost">Costo: S/ ${cost.toFixed(2)}</div>
            <div class="calc-size-price">S/ ${rounded.toFixed(2)}</div>
            <div class="calc-size-gain" style="color:var(--green)">+S/ ${(rounded - cost).toFixed(2)}</div>
          </div>`;
        }).join('')}
      </div>
      <p style="font-size:.72rem;color:var(--text3);margin-top:.5rem">*Precio redondeado al S/ 0.50 más cercano para facilitar el cobro.</p>`;
    return true;
  }

  [priceInput, mlInput, marginInput].forEach(inp => {
    inp?.addEventListener('input', calculate);
  });

  btn.addEventListener('click', () => {
    const success = calculate();
    if (!success) {
      showToast('Ingresa precio del frasco y ml totales válidos.');
    }
  });
}

// ── Exportar pedidos a CSV ────────────────────────────────────────────────────

function setupCsvExport() {
  const btn = document.getElementById('exportCsvBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Exportando…';
    try {
      const statusFilter = document.getElementById('csvStatusFilter')?.value || 'all';
      let orders = await CloudOrders.getAll();
      if (statusFilter !== 'all') orders = orders.filter(o => o.status === statusFilter);

      const rows = [
        ['ID', 'Fecha', 'Cliente', 'Teléfono', 'DNI', 'Entrega', 'Departamento', 'Productos', 'Total', 'Estado', 'Método Pago', 'Notas']
      ];

      orders.forEach(o => {
        const items = (o.items || []).map(i => `${i.brand} ${i.productName} ${i.size} x${i.quantity}`).join(' | ');
        const fecha = new Date(o.date).toLocaleDateString('es-PE');
        rows.push([
          o.id, fecha,
          o.customerName || '', o.customerPhone || '', o.customerDni || '',
          o.deliveryType === 'recojo' ? 'Recojo' : 'Shalom',
          o.department || '',
          items,
          o.total.toFixed(2),
          o.status,
          o.paymentMethod || '',
          o.notes || ''
        ]);
      });

      const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `pedidos_micht_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`${orders.length} pedidos exportados ✓`);
    } catch (err) {
      console.error(err);
      showToast('Error al exportar.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar CSV`;
    }
  });
}

// ── WhatsApp masivo ───────────────────────────────────────────────────────────

async function setupWhatsAppTool() {
  const btn = document.getElementById('waGenBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;

  // Cargar teléfonos únicos de pedidos
  const orders = await CloudOrders.getAll().catch(() => []);
  const phoneMap = {};
  orders.forEach(o => {
    if (o.customerPhone && o.customerName) {
      phoneMap[o.customerPhone] = o.customerName;
    }
  });
  const phones = Object.entries(phoneMap);

  const countEl = document.getElementById('waClientsCount');
  if (countEl) countEl.textContent = `${phones.length} cliente${phones.length !== 1 ? 's' : ''} con teléfono`;

  btn.addEventListener('click', () => {
    const msg = document.getElementById('waMessageText')?.value.trim();
    if (!msg) { showToast('Escribe un mensaje primero.'); return; }
    if (!phones.length) { showToast('No hay clientes con teléfono registrado.'); return; }

    const result = document.getElementById('waLinksResult');
    const encoded = encodeURIComponent(msg);

    result.innerHTML = `
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:.5rem">${phones.length} links generados — haz clic en cada uno para abrir WhatsApp:</div>
      <div class="wa-links-grid">
        ${phones.map(([phone, name]) => {
          const cleanPhone = phone.replace(/\D/g, '');
          const num = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;
          return `
          <a class="wa-link-item" href="https://wa.me/${num}?text=${encoded}" target="_blank" rel="noopener noreferrer">
            <span class="wa-link-name">${sanitize(name)}</span>
            <span class="wa-link-phone">${sanitize(phone)}</span>
            <span class="wa-link-icon">→</span>
          </a>`;
        }).join('')}
      </div>`;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ETIQUETA DE ENVÍO ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function openShippingLabel(orderId) {
  const order = await CloudOrders.getById(orderId);
  if (!order) { showToast('No se pudo cargar el pedido.'); return; }
  if (order.deliveryType !== 'envio') { showToast('Este pedido es de recojo en tienda, no tiene etiqueta de envío.'); return; }

  const content = document.getElementById('shippingLabelContent');
  if (!content) return;

  const date = new Date(order.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const items = (order.items || []).map(i => `${i.brand} ${i.productName} ${i.size} ×${i.quantity}`).join('\n');

  content.innerHTML = `
    <div id="shippingLabelPrint" class="shipping-label">
      <div class="sl-header">
        <div class="sl-brand">MICHT Decants</div>
        <div class="sl-id">${sanitize(order.id)}</div>
      </div>
      <div class="sl-divider"></div>
      <div class="sl-section">
        <div class="sl-label">DESTINATARIO</div>
        <div class="sl-value sl-name">${sanitize(order.customerName || '—')}</div>
        ${order.customerDni ? `<div class="sl-value">DNI: ${sanitize(order.customerDni)}</div>` : ''}
        ${order.customerPhone ? `<div class="sl-value">Tel: ${sanitize(order.customerPhone)}</div>` : ''}
      </div>
      <div class="sl-divider"></div>
      <div class="sl-section">
        <div class="sl-label">DESTINO</div>
        <div class="sl-value sl-name">${sanitize(order.department || '')}${order.province ? ` — ${sanitize(order.province)}` : ''}</div>
        ${order.shalomOffice ? `<div class="sl-value">Agencia Shalom: ${sanitize(order.shalomOffice)}</div>` : ''}
      </div>
      <div class="sl-divider"></div>
      <div class="sl-section">
        <div class="sl-label">CONTENIDO</div>
        ${(order.items || []).map(i => `
          <div class="sl-item-row">
            <span>${sanitize(i.brand)} ${sanitize(i.productName)} ${sanitize(i.size)}</span>
            <span>×${i.quantity}</span>
          </div>`).join('')}
      </div>
      <div class="sl-divider"></div>
      <div class="sl-footer">
        <span>Fecha: ${date}</span>
        <span>Total: S/ ${order.total.toFixed(2)}</span>
      </div>
    </div>`;

  document.getElementById('shippingLabelModal').classList.add('open');
}

function printShippingLabel() {
  const label = document.getElementById('shippingLabelPrint');
  if (!label) return;
  const win = window.open('', '_blank', 'width=420,height=600');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiqueta de Envío</title>
  <style>
    body { margin: 0; padding: 20px; font-family: 'Courier New', monospace; background: #fff; color: #000; }
    .shipping-label { border: 2px solid #000; border-radius: 8px; padding: 16px; max-width: 360px; margin: auto; }
    .sl-header { display: flex; justify-content: space-between; align-items: center; }
    .sl-brand { font-size: 1.1rem; font-weight: 900; letter-spacing: .08em; }
    .sl-id { font-size: .75rem; color: #555; }
    .sl-divider { border-top: 1px dashed #888; margin: 10px 0; }
    .sl-section { margin-bottom: 4px; }
    .sl-label { font-size: .65rem; font-weight: 700; letter-spacing: .12em; color: #555; text-transform: uppercase; margin-bottom: 3px; }
    .sl-name { font-size: 1rem; font-weight: 700; }
    .sl-value { font-size: .82rem; margin-bottom: 2px; }
    .sl-item-row { display: flex; justify-content: space-between; font-size: .78rem; margin-bottom: 2px; }
    .sl-footer { display: flex; justify-content: space-between; font-size: .75rem; color: #555; }
  </style></head><body>${label.outerHTML}<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  win.document.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NOTAS INTERNAS POR PEDIDO ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function saveAdminNote(orderId, note) {
  // Guardar en localStorage
  const notes = JSON.parse(localStorage.getItem('micht_admin_notes') || '{}');
  notes[orderId] = note;
  localStorage.setItem('micht_admin_notes', JSON.stringify(notes));
  // Intentar guardar en Supabase si existe la columna
  if (db) {
    try {
      await db.from('pedidos').update({ admin_notes: note, updated_at: new Date().toISOString() }).eq('id', orderId);
    } catch (_) {}
  }
}

function getAdminNote(orderId) {
  const notes = JSON.parse(localStorage.getItem('micht_admin_notes') || '{}');
  return notes[orderId] || '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ALERTAS DE STOCK EN SECCIÓN PERFUMES ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function renderLowStockBanner() {
  const container = document.getElementById('adminProductList');
  if (!container) return;

  const products = await CloudProducts.getAll().catch(() => []);
  const low = products.filter(p => {
    if (!p.inStock) return false;
    if (p.type === 'entero') return (p.stockQuantity || 0) <= 1;
    return p.bottleTotalMl > 0 && (p.bottleRemainingMl || 0) > 0 && (p.bottleRemainingMl || 0) < 15;
  });

  const existing = document.getElementById('lowStockBanner');
  if (existing) existing.remove();
  if (!low.length) return;

  const banner = document.createElement('div');
  banner.id = 'lowStockBanner';
  banner.className = 'low-stock-banner';
  banner.innerHTML = `
    <div class="lsb-icon">⚠</div>
    <div class="lsb-content">
      <strong>${low.length} perfume${low.length !== 1 ? 's' : ''} con stock bajo:</strong>
      <span class="lsb-list">${low.map(p => sanitize(p.brand + ' ' + p.name)).join(' · ')}</span>
    </div>
    <button class="lsb-close" onclick="this.parentElement.remove()">×</button>`;
  container.parentElement.insertBefore(banner, container);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SUPABASE REALTIME — notificación de nuevos pedidos ───────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let _realtimeChannel = null;

function startRealtimeOrders() {
  if (!db || _realtimeChannel) return;

  // Solo activo si Supabase tiene Realtime habilitado en la tabla pedidos.
  // Si no lo está, este bloque falla silenciosamente.
  try {
    _realtimeChannel = db
      .channel('pedidos-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => {
          const order = orderFromDB(payload.new);
          _showNewOrderToast(order);
          // Refrescar tabla y stats si la sección Pedidos está activa
          const ordersSection = document.getElementById('section-orders');
          if (ordersSection?.classList.contains('active')) {
            renderOrdersSection().catch(console.error);
          }
          // Actualizar badge en nav si existe
          _updatePendingBadge();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.info('[MICHT Realtime] Canal no disponible — activa Realtime en Supabase para esta tabla.');
          _realtimeChannel = null;
        }
      });
  } catch (err) {
    console.info('[MICHT Realtime] No disponible:', err?.message);
    _realtimeChannel = null;
  }
}

function _showNewOrderToast(order) {
  const toast = document.getElementById('newOrderToast');
  const msg   = document.getElementById('newOrderToastMsg');
  if (!toast || !msg) return;

  const name  = order.customerName ? `de ${order.customerName}` : '';
  const total = order.total > 0 ? ` · S/ ${order.total.toFixed(2)}` : '';
  msg.textContent = `Pedido ${name}${total}`;
  toast.style.display = 'block';

  // Auto-ocultar a los 12 segundos
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 12000);

  // Sonido de notificación (tono suave)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

function _updatePendingBadge() {
  CloudOrders.getAll().then(orders => {
    const pending = orders.filter(o => o.status === 'pendiente').length;
    const btn = document.querySelector('[data-section="orders"]');
    if (!btn) return;
    let badge = btn.querySelector('.nav-badge');
    if (pending > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;background:#ef5350;color:#fff;border-radius:50px;font-size:.62rem;font-weight:800;margin-left:.35rem;line-height:1';
        btn.appendChild(badge);
      }
      badge.textContent = pending > 99 ? '99+' : pending;
    } else {
      badge?.remove();
    }
  }).catch(() => {});
}

// ─── Módulo de Control de Caja (POS Cash Sessions) ──────────────────────────

const CajaManager = {
  _storageKey: 'micht_caja_sesiones',
  _activeKey: 'micht_caja_activa',

  // Cargar historial de sesiones
  getHistorial() {
    try {
      return JSON.parse(localStorage.getItem(this._storageKey) || '[]');
    } catch (e) {
      console.error('Error al cargar historial de caja:', e);
      return [];
    }
  },

  // Guardar historial de sesiones
  saveHistorial(historial) {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(historial));
    } catch (e) {
      console.error('Error al guardar historial de caja:', e);
    }
  },

  // Cargar sesión activa
  getSesionActiva() {
    try {
      return JSON.parse(localStorage.getItem(this._activeKey) || 'null');
    } catch (e) {
      console.error('Error al cargar sesión activa de caja:', e);
      return null;
    }
  },

  // Guardar sesión activa
  saveSesionActiva(sesion) {
    try {
      localStorage.setItem(this._activeKey, JSON.stringify(sesion));
    } catch (e) {
      console.error('Error al guardar sesión activa de caja:', e);
    }
  },

  // Abrir Caja
  abrirCaja(montoInicial) {
    const sesion = {
      id: 'CAJA-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
      fechaApertura: new Date().toISOString(),
      montoApertura: parseFloat(montoInicial) || 0,
      estado: 'abierto',
      fechaCierre: null,
      ventasEfectivo: 0,
      ventasYape: 0,
      ventasPlin: 0,
      ventasTransferencia: 0,
      montoEsperado: parseFloat(montoInicial) || 0,
      montoReal: null,
      discrepancia: null,
      notas: ''
    };
    this.saveSesionActiva(sesion);
    return sesion;
  },

  // Cerrar Caja
  cerrarCaja(montoReal, notas, expectedSales) {
    const sesion = this.getSesionActiva();
    if (!sesion) return null;

    sesion.estado = 'cerrado';
    sesion.fechaCierre = new Date().toISOString();
    sesion.ventasEfectivo = expectedSales.efectivo;
    sesion.ventasYape = expectedSales.yape;
    sesion.ventasPlin = expectedSales.plin;
    sesion.ventasTransferencia = expectedSales.transferencia;
    
    sesion.montoEsperado = sesion.montoApertura + expectedSales.efectivo;
    sesion.montoReal = parseFloat(montoReal) || 0;
    sesion.discrepancia = sesion.montoReal - sesion.montoEsperado;
    sesion.notas = notas || '';

    // Guardar en historial
    const historial = this.getHistorial();
    historial.unshift(sesion);
    this.saveHistorial(historial);

    // Limpiar sesión activa
    localStorage.removeItem(this._activeKey);
    return sesion;
  },

  // Calcular las ventas realizadas en un rango de fecha
  async calcularVentas(fechaInicio, fechaFin = null) {
    const orders = await CloudOrders.getAll().catch(() => []);
    const inicio = new Date(fechaInicio).getTime();
    const fin = fechaFin ? new Date(fechaFin).getTime() : Date.now();

    const ventas = {
      efectivo: 0,
      yape: 0,
      plin: 0,
      transferencia: 0,
      total: 0
    };

    orders.forEach(o => {
      if (o.status !== 'pagado') return;
      const orderTime = new Date(o.date).getTime();
      if (orderTime >= inicio && orderTime <= fin) {
        const pm = (o.paymentMethod || '').toLowerCase();
        if (pm === 'efectivo') {
          ventas.efectivo += o.total;
        } else if (pm === 'yape') {
          ventas.yape += o.total;
        } else if (pm === 'plin') {
          ventas.plin += o.total;
        } else if (pm === 'transferencia' || pm === 'banco') {
          ventas.transferencia += o.total;
        }
        ventas.total += o.total;
      }
    });

    return ventas;
  },

  // Eliminar un turno del historial
  eliminarSesion(id) {
    const historial = this.getHistorial().filter(s => s.id !== id);
    this.saveHistorial(historial);
  }
};

async function renderCajaSection() {
  const activePanel = document.getElementById('cajaActivePanel');
  const historyBody = document.getElementById('cajaHistoryTableBody');
  const statusLabel = document.getElementById('cajaStatusLabel');
  if (!activePanel || !historyBody) return;

  const sesion = CajaManager.getSesionActiva();

  if (sesion) {
    // Caja abierta: Actualizar estado de indicador
    statusLabel.className = 'caja-status-pill open';
    statusLabel.textContent = 'Abierta';

    // Calcular ventas acumuladas de la sesión activa
    const ventas = await CajaManager.calcularVentas(sesion.fechaApertura);
    const montoEsperado = sesion.montoApertura + ventas.efectivo;

    // Renderizar panel de caja activa
    activePanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border);padding-bottom:.8rem;flex-wrap:wrap;gap:.5rem">
        <div>
          <span style="font-size:.73rem;color:var(--text3);font-family:sans-serif">TURNO ACTIVO</span>
          <h3 style="color:var(--white);font-size:1.15rem;margin:0;font-family:'Playfair Display',serif">${sesion.id}</h3>
          <span style="font-size:.78rem;color:var(--text2)">Abierta el ${new Date(sesion.fechaApertura).toLocaleString('es-PE')}</span>
        </div>
        <button id="cajaCerrarBtn" class="btn-delete" style="padding:.5rem 1.2rem;font-size:.8rem;font-weight:700">Cerrar Turno de Caja</button>
      </div>

      <div class="caja-info-grid">
        <div class="caja-info-card">
          <span class="caja-info-title">💵 Fondo Inicial</span>
          <span class="caja-info-value gold">S/ ${sesion.montoApertura.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">💵 Ventas Efectivo</span>
          <span class="caja-info-value">S/ ${ventas.efectivo.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">📱 Ventas Yape</span>
          <span class="caja-info-value">S/ ${ventas.yape.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">📲 Ventas Plin</span>
          <span class="caja-info-value">S/ ${ventas.plin.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">🏦 Transferencias</span>
          <span class="caja-info-value">S/ ${ventas.transferencia.toFixed(2)}</span>
        </div>
        <div class="caja-info-card" style="border-color:rgba(37,211,102,.2)">
          <span class="caja-info-title" style="color:#25d366">💵 Esperado en Caja</span>
          <span class="caja-info-value green">S/ ${montoEsperado.toFixed(2)}</span>
        </div>
      </div>

      <div style="background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:var(--r);padding:.9rem 1.1rem;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:.8rem;color:var(--text2)">Total recaudado en billeteras/bancos (sin efectivo):</span>
        <strong style="color:var(--gold);font-size:.95rem">S/ ${(ventas.yape + ventas.plin + ventas.transferencia).toFixed(2)}</strong>
      </div>
    `;

    // Vincular botón cerrar caja
    document.getElementById('cajaCerrarBtn')?.addEventListener('click', () => {
      openCerrarCajaDialog(ventas);
    });

  } else {
    // Caja cerrada: Actualizar estado de indicador
    statusLabel.className = 'caja-status-pill closed';
    statusLabel.textContent = 'Cerrada';

    activePanel.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem">
        <span style="font-size:2.2rem;display:block;margin-bottom:.5rem">🔒</span>
        <h3 style="color:var(--white);font-size:1.1rem;margin:0;font-family:'Playfair Display',serif">La caja está cerrada</h3>
        <p style="color:var(--text3);font-size:.83rem;margin-top:.3rem;margin-bottom:1.5rem">Para registrar ventas y controlar el cuadre diario, inicia un nuevo turno de caja.</p>
        <button id="cajaAbrirBtn" class="btn-add" style="padding:.6rem 1.6rem;font-size:.82rem;font-weight:700">+ Abrir Turno de Caja</button>
      </div>
    `;

    // Vincular botón abrir caja
    document.getElementById('cajaAbrirBtn')?.addEventListener('click', openAbrirCajaDialog);
  }

  // Renderizar historial
  renderCajaHistorial();
}

function openAbrirCajaDialog() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Apertura de Caja POS</h3>
        <button id="closeAbrirCaja" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer">✕</button>
      </div>

      <div style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem">
        <div class="caja-form-group">
          <label for="aperturaMonto">Monto Inicial (Fondo en Efectivo) *</label>
          <input id="aperturaMonto" type="number" placeholder="0.00" step="0.10" min="0" style="font-size:1rem;padding:.6rem">
        </div>
        
        <p style="font-size:.73rem;color:var(--text3);margin:0;line-height:1.4">Este monto representa el dinero físico (sencillo/cambio) con el que se arranca el turno en caja chica.</p>

        <button id="confirmAbrirCaja" class="btn-add" style="width:100%;padding:.7rem;font-weight:700;font-size:.82rem;margin-top:.4rem">CONFIRMAR APERTURA</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.style.opacity = '1', 30);

  const closeBtn = document.getElementById('closeAbrirCaja');
  const confirmBtn = document.getElementById('confirmAbrirCaja');
  const inputVal = document.getElementById('aperturaMonto');

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 220);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  inputVal.focus();

  confirmBtn.addEventListener('click', () => {
    const val = parseFloat(inputVal.value);
    if (isNaN(val) || val < 0) {
      showToast('Por favor, ingresa un monto inicial válido.');
      return;
    }

    CajaManager.abrirCaja(val);
    close();
    showToast('🚀 Caja abierta con éxito.');
    renderCajaSection();
  });
}

function openCerrarCajaDialog(ventas) {
  const sesion = CajaManager.getSesionActiva();
  if (!sesion) return;

  const montoEsperado = sesion.montoApertura + ventas.efectivo;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;width:100%;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Cierre y Cuadre de Caja</h3>
        <button id="closeCerrarCaja" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer">✕</button>
      </div>

      <div style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem">
        <div style="background:rgba(255,255,255,.01);border:1px solid var(--border);border-radius:6px;padding:.8rem;display:flex;justify-content:space-between">
          <span style="font-size:.8rem;color:var(--text2)">Efectivo esperado en caja:</span>
          <strong style="color:#25d366;font-size:.92rem">S/ ${montoEsperado.toFixed(2)}</strong>
        </div>

        <div class="caja-form-group">
          <label for="cierreMontoReal">Efectivo Real Contado en Caja *</label>
          <input id="cierreMontoReal" type="number" placeholder="0.00" step="0.10" min="0" style="font-size:1.15rem;padding:.6rem;font-weight:700">
        </div>

        <!-- Discrepancia interactiva -->
        <div id="cierreDiscrepanciaBox" class="caja-discrepancy-box neutral">
          <span>DIFERENCIA (CUADRE)</span>
          <span id="cierreDiscrepanciaVal">-S/ ${montoEsperado.toFixed(2)}</span>
        </div>

        <div class="caja-form-group">
          <label for="cierreNotas">Notas del Cierre (Opcional)</label>
          <textarea id="cierreNotas" rows="2" placeholder="Detalles de descuadre, faltantes o anotaciones sobre el turno..." style="font-size:.83rem;resize:none"></textarea>
        </div>

        <button id="confirmCerrarCaja" class="btn-delete" style="width:100%;padding:.75rem;font-weight:700;font-size:.82rem;margin-top:.4rem;border-radius:6px">CONFIRMAR CIERRE DE CAJA</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.style.opacity = '1', 30);

  const closeBtn = document.getElementById('closeCerrarCaja');
  const confirmBtn = document.getElementById('confirmCerrarCaja');
  const inputReal = document.getElementById('cierreMontoReal');
  const discBox = document.getElementById('cierreDiscrepanciaBox');
  const discVal = document.getElementById('cierreDiscrepanciaVal');
  const notesText = document.getElementById('cierreNotas');

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 220);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  inputReal.focus();

  // Escuchar inputs para calcular cuadre en tiempo real
  inputReal.addEventListener('input', () => {
    const val = parseFloat(inputReal.value) || 0;
    const diff = val - montoEsperado;

    discVal.textContent = (diff >= 0 ? '+S/ ' : '-S/ ') + Math.abs(diff).toFixed(2);

    discBox.className = 'caja-discrepancy-box';
    if (diff === 0) {
      discBox.classList.add('ok');
    } else if (diff < 0) {
      discBox.classList.add('error');
    } else {
      discBox.classList.add('surplus');
    }
  });

  confirmBtn.addEventListener('click', () => {
    const val = parseFloat(inputReal.value);
    if (isNaN(val) || val < 0) {
      showToast('Por favor, ingresa el monto físico real contado.');
      return;
    }

    CajaManager.cerrarCaja(val, notesText.value.trim(), ventas);
    close();
    showToast('🔒 Turno de caja cerrado e historiado.');
    renderCajaSection();
  });
}

function renderCajaHistorial() {
  const historyBody = document.getElementById('cajaHistoryTableBody');
  if (!historyBody) return;

  const sessions = CajaManager.getHistorial();

  if (!sessions.length) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;color:var(--text3);padding:2.5rem;font-style:italic">No hay turnos cerrados en el historial.</td>
      </tr>
    `;
    return;
  }

  historyBody.innerHTML = sessions.map(s => {
    const diff = s.discrepancia;
    let diffClass = 'green';
    let diffSymbol = '';
    if (diff < 0) {
      diffClass = 'red';
      diffSymbol = '-';
    } else if (diff > 0) {
      diffClass = 'gold';
      diffSymbol = '+';
    }

    const fechaAperturaStr = new Date(s.fechaApertura).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    const fechaCierreStr = s.fechaCierre ? new Date(s.fechaCierre).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

    return `
      <tr>
        <td>
          <strong style="color:var(--white);font-size:.8rem">${s.id}</strong><br>
          <span style="font-size:.73rem;color:var(--text3)">Apertura: ${fechaAperturaStr}</span>
        </td>
        <td>
          <span style="font-size:.78rem;color:var(--text2)">${fechaCierreStr}</span>
        </td>
        <td style="text-align:right;font-size:.82rem">S/ ${s.montoApertura.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem">S/ ${s.ventasEfectivo.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem;color:var(--text2)">S/ ${s.montoEsperado.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem;font-weight:700;color:var(--white)">S/ ${s.montoReal.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem;font-weight:700" class="${diffClass}">${diffSymbol}S/ ${Math.abs(diff).toFixed(2)}</td>
        <td style="text-align:center">
          <span class="caja-status-pill closed" style="font-size:.62rem;padding:.15rem .45rem">Cerrado</span>
        </td>
        <td style="text-align:center">
          <button class="caja-history-delete-btn btn-delete" data-id="${s.id}" style="padding:.2rem .5rem;font-size:.65rem;border-radius:4px" title="Eliminar del historial">Eliminar</button>
        </td>
      </tr>
      ${s.notas ? `
        <tr class="caja-notes-row" style="background:rgba(255,255,255,.01)">
          <td colspan="9" style="padding:.4rem 1.2rem;font-size:.73rem;color:var(--text3);border-top:none">
            📝 <strong>Anotaciones:</strong> ${sanitize(s.notas)}
          </td>
        </tr>
      ` : ''}
    `;
  }).join('');

  // Enlazar botones eliminar del historial
  historyBody.querySelectorAll('.caja-history-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm(`¿Seguro que deseas eliminar el turno ${id} del historial?`)) {
        CajaManager.eliminarSesion(id);
        showToast('Turno eliminado del historial.');
        renderCajaHistorial();
      }
    });
  });
}

// Arrancar Realtime cuando el dashboard esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Se inicia después de que showDashboard() confirme que el admin está autenticado.
  // Usamos MutationObserver para esperar a que el dashboardSection sea visible.
  const dashEl = document.getElementById('dashboardSection');
  if (!dashEl) return;
  const obs = new MutationObserver(() => {
    if (dashEl.style.display !== 'none') {
      obs.disconnect();
      startRealtimeOrders();
      _updatePendingBadge();
    }
  });
  obs.observe(dashEl, { attributes: true, attributeFilter: ['style'] });
});
