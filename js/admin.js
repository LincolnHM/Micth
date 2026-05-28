// ─── Panel Administrador — MICHT Decants ─────────────────────────────────────

let _adminProductSearch = '';
let _adminProductTypeFilter = 'all';
let _customerHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!SUPABASE_READY) {
    // Sin Supabase no hay acceso — evita la puerta trasera por sessionStorage
    showNoDbScreen();
    return;
  }
  const { data: { session } } = await db.auth.getSession();
  if (session) { await showDashboard(); }
  else { showLoginScreen(); }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
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

async function showDashboard() {
  document.getElementById('loginSection').style.display    = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  await CloudProducts.getAll();
  renderAdminProducts().catch(console.error);
  renderOrdersSection().catch(console.error);
  setupAdminEvents();
  setupOrderEvents();
  setupAccountingEvents();
  setupNav();
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

  const { error } = await db.auth.signInWithPassword({ email, password: pw });

  if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }

  if (error) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.style.display = 'block';
  } else {
    await showDashboard();
  }
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
      if (btn.dataset.section === 'inventory')   renderInventorySection().catch(console.error);
      if (btn.dataset.section === 'orders')      renderOrdersSection().catch(console.error);
      if (btn.dataset.section === 'orders')      updateOrderStats().catch(console.error);
      if (btn.dataset.section === 'accounting')  renderAccountingSection().catch(console.error);
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
  let products    = await CloudProducts.getAll();
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

  // Mapa de SVGs de respaldo indexado por id (evita poner data-URIs enormes en atributos HTML)
  window._adminImgFallback = {};
  products.forEach(p => { window._adminImgFallback[p.id] = buildProductImage(p); });

  container.innerHTML = products.map(p => {
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
}

// ─── Sección: Inventario (ml) ─────────────────────────────────────────────────

async function renderInventorySection() {
  const products = await CloudProducts.getAll();
  const list = document.getElementById('inventoryList');
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

async function updateOrderStats() {
  const stats = await CloudOrders.getStats();
  const bar = document.getElementById('orderStatsBar');
  if (!bar) return;
  bar.innerHTML = `
    <div class="stat-card"><div class="stat-val" style="color:var(--gold)">${stats.total}</div><div class="stat-label">Total</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--orange)">${stats.pendiente}</div><div class="stat-label">Pendientes</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--green)">${stats.pagado}</div><div class="stat-label">Pagados</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#ef5350">${stats.cancelado}</div><div class="stat-label">Cancelados</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--gold-d)">S/${stats.revenue.toFixed(0)}</div><div class="stat-label">Facturado</div></div>
  `;
}

async function renderOrdersSection() {
  updateOrderStats();
  let orders = await CloudOrders.getAll();
  if (orderStatusFilter !== 'all') orders = orders.filter(o => o.status === orderStatusFilter);

  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem">No hay pedidos ${orderStatusFilter !== 'all' ? 'con ese estado' : 'registrados'}</td></tr>`;
    return;
  }

  const STATUS_LABELS = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };
  const SELECT_OPTIONS = ['pendiente', 'pagado', 'cancelado'];

  tbody.innerHTML = orders.map(o => {
    const date   = new Date(o.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const items  = o.items.map(i => `${i.productName} ${i.size} ×${i.quantity}`).join(', ');
    const delivLabel = o.deliveryType === 'recojo' ? '🏪 Recojo' : '📦 Shalom';
    const safeStatus = o.status.replace(/[^a-z]/g, '');
    // Si el pedido tiene un estado antiguo (enviado/entregado), mostrar en select como pendiente
    const selectVal  = SELECT_OPTIONS.includes(o.status) ? o.status : 'pendiente';

    return `
    <tr>
      <td><span class="order-id">${o.id}</span></td>
      <td><span class="order-customer">${sanitize(o.customerName || '—')}</span><br><span class="order-date">${sanitize(o.customerPhone || '')}</span></td>
      <td class="order-date">${date}<br><small style="color:var(--text3)">${delivLabel}</small></td>
      <td style="font-size:.75rem;color:var(--text2);max-width:200px">${sanitize(items)}</td>
      <td class="order-total-cell">S/ ${o.total.toFixed(2)}</td>
      <td><span class="status-badge status-${safeStatus}">${STATUS_LABELS[o.status] || o.status}</span></td>
      <td>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
          <select class="order-action-select" data-id="${escapeAttr(o.id)}" data-status="${escapeAttr(o.status)}" aria-label="Cambiar estado">
            ${SELECT_OPTIONS.map(s =>
              `<option value="${s}" ${selectVal === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`
            ).join('')}
          </select>
          <button class="btn-order-detail" data-id="${escapeAttr(o.id)}">Ver</button>
          <button class="btn-delete-order" data-id="${escapeAttr(o.id)}"
                  style="font-size:.72rem;padding:.3rem .6rem;background:transparent;color:#ef5350;border:1px solid #ef5350;border-radius:var(--r);cursor:pointer;font-weight:600;transition:background .15s,color .15s"
                  onmouseover="this.style.background='#ef5350';this.style.color='#fff'"
                  onmouseout="this.style.background='transparent';this.style.color='#ef5350'">Borrar</button>
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

      const doUpdate = async () => {
        try {
          await CloudOrders.updateStatus(id, newStatus);
          sel.dataset.status = newStatus;
          renderOrdersSection().catch(console.error);
          showToast(`Pedido ${id} → ${STATUS_LABELS[newStatus]}`);
        } catch (err) {
          console.error('Error al actualizar estado:', err);
          sel.value = prevStatus;
          showToast('Error al actualizar el pedido. Inténtalo de nuevo.');
        }
      };

      if (newStatus === 'pagado') {
        sel.value = prevStatus; // revertir visualmente mientras carga
        CloudOrders.getById(id).then(order => {
          const items = order?.items || [];
          const mlLines = items
            .filter(i => parseInt(i.size) > 0)
            .map(i => `  • ${i.productName} ${i.size} ×${i.quantity} = ${parseInt(i.size) * i.quantity} ml`)
            .join('\n');
          const msg = mlLines
            ? `Se descontará del stock al confirmar:\n\n${mlLines}\n\n¿Confirmar pago?`
            : `¿Confirmar el pedido ${id} como PAGADO?`;

          showConfirmModal(msg,
            () => { sel.value = newStatus; doUpdate(); },
            () => { sel.value = prevStatus; }
          );
        }).catch(() => {
          showConfirmModal(
            `¿Confirmar el pedido ${id} como PAGADO?`,
            () => { sel.value = newStatus; doUpdate(); },
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
    <div style="display:flex;justify-content:space-between;margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border-l)">
      <strong style="color:var(--text)">Total</strong>
      <strong style="color:var(--gold);font-size:1.05rem">S/ ${order.total.toFixed(2)}</strong>
    </div>
    ${order.notes ? `<div class="order-detail-row"><span class="lbl">Notas</span><span class="val">${sanitize(order.notes)}</span></div>` : ''}
  `;

  modal.classList.add('open');
}

function setupOrderEvents() {
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
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        const nameEl  = document.getElementById('regCustomerName');
        const phoneEl = document.getElementById('regCustomerPhone');
        const dniEl   = document.getElementById('regCustomerDni');
        if (nameEl)  nameEl.value  = opt.dataset.name;
        if (opt.dataset.phone && phoneEl) phoneEl.value = opt.dataset.phone;
        if (opt.dataset.dni   && dniEl)   dniEl.value   = opt.dataset.dni;
        dropdown.style.display = 'none';
        showToast('✓ Datos del cliente cargados automáticamente');
      });
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
    else if (e.key === 'Enter' && cur) { e.preventDefault(); cur.dispatchEvent(new MouseEvent('mousedown')); }
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
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        hiddenInput.value  = opt.dataset.value;
        searchInput.value  = opt.dataset.label;
        dropdown.style.display = 'none';
      });
    });
  }

  searchInput.addEventListener('input',  () => renderDropdown(searchInput.value));
  searchInput.addEventListener('focus',  () => renderDropdown(searchInput.value));
  searchInput.addEventListener('blur',   () => setTimeout(() => { dropdown.style.display = 'none'; }, 180));

  container.appendChild(row);
  searchInput.focus();
}

async function saveManualOrder() {
  const name  = document.getElementById('regCustomerName').value.trim();
  const phone = document.getElementById('regCustomerPhone').value.trim();
  const dni   = document.getElementById('regCustomerDni').value.trim();
  const dtype = document.getElementById('regDeliveryType').value;
  const notes = document.getElementById('regNotes').value.trim();

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

  // Validar stock antes de guardar
  const stockErrors = [];
  items.forEach(item => {
    const product = Products.getById(item.productId);
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
    alert('⚠ Stock insuficiente:\n\n' + stockErrors.join('\n') + '\n\nAjusta las cantidades antes de guardar.');
    return;
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const saveBtn = document.getElementById('saveOrderBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

  try {
    await CloudOrders.create({ customerName: name, customerPhone: phone, customerDni: dni, deliveryType: dtype, notes, items, total });

    // Descontar stock al registrar el pedido
    const agotados = [];
    for (const item of items) {
      const product = Products.getById(item.productId);
      if (!product) continue;
      if (product.type === 'entero') {
        const qty    = item.quantity || 1;
        const newQty = Math.max(0, (product.stockQuantity || 0) - qty);
        await CloudProducts.update(item.productId, { stockQuantity: newQty, inStock: newQty > 0 });
        if (newQty === 0) agotados.push(product.name);
      } else if (product.availableAsEntero && item.size === 'Unidad') {
        await CloudProducts.update(item.productId, { availableAsEntero: false, bottleRemainingMl: 0, inStock: false });
        agotados.push(product.name);
      }
    }

    document.getElementById('registerOrderModal').classList.remove('open');
    await renderOrdersSection();
    renderAdminProducts().catch(console.error);
    const msg = agotados.length
      ? `Pedido registrado ✓  |  Agotado: ${agotados.join(', ')}`
      : 'Pedido registrado correctamente ✓';
    showToast(msg);
  } catch (err) {
    console.error(err);
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
  row.querySelector('.remove-size-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function setupAdminEvents() {
  document.getElementById('adminProductSearch')?.addEventListener('input', function() {
    _adminProductSearch = this.value.trim();
    renderAdminProducts().catch(console.error);
  });

  document.querySelectorAll('.admin-type-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      _adminProductTypeFilter = btn.dataset.type;
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

  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());

  document.getElementById('closeProductModal').addEventListener('click', () => {
    document.getElementById('productModal').classList.remove('open');
  });
  document.getElementById('cancelProductModal').addEventListener('click', () => {
    document.getElementById('productModal').classList.remove('open');
  });

  document.getElementById('addSizeBtn').addEventListener('click', () => addSizeRow());

  document.getElementById('saveProductBtn').addEventListener('click', async () => {
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

  imgZone.addEventListener('click', () => imgInput.click());
  imgZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') imgInput.click(); });
  imgInput.addEventListener('change', () => { if (imgInput.files[0]) handleImageFile(imgInput.files[0]); });

  imgZone.addEventListener('dragover', e => { e.preventDefault(); imgZone.classList.add('drag-over'); });
  imgZone.addEventListener('dragleave', () => imgZone.classList.remove('drag-over'));
  imgZone.addEventListener('drop', e => {
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
    t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:var(--card);border:1px solid var(--gold-d);color:var(--text);padding:.75rem 1.25rem;border-radius:var(--r);font-size:.85rem;z-index:9999;box-shadow:var(--sh);transition:all .3s;opacity:0;transform:translateY(10px)';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, 2800);
}

function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ─── Sección: Contabilidad ────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getExpenses(year) {
  try { return JSON.parse(localStorage.getItem(`micht_expenses_${year}`) || '[]'); }
  catch { return []; }
}

function saveExpenses(year, expenses) {
  localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(expenses));
}

function getMonthlyStats(orders, year) {
  const filtered = orders.filter(o => new Date(o.date).getFullYear() === year);
  const expenses = getExpenses(year);
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
  const stats = getMonthlyStats(allOrders, year);
  const now   = new Date();

  // Calcular totales
  const totalRevenue  = stats.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = stats.reduce((s, m) => s + m.expenses, 0);
  const totalNet      = totalRevenue - totalExpenses;
  const bestMonth     = stats.reduce((b, m) => m.revenue > b.revenue ? m : b, stats[0]);
  const currentMonth  = stats[now.getMonth()];
  const paidTotal     = stats.reduce((s, m) => s + m.paid, 0);
  const activeMonths  = stats.filter(m => m.revenue > 0).length || 1;

  // ── Tarjetas de resumen ──────────────────────────────────────────────────────
  const summary = document.getElementById('accountingSummary');
  summary.innerHTML = [
    { label: `Total ${year}`, val: `S/ ${totalRevenue.toFixed(0)}`, sub: `${paidTotal} pedidos pagados`, color: 'var(--gold)' },
    { label: 'Mejor Mes',    val: bestMonth.revenue > 0 ? bestMonth.name : '—', sub: bestMonth.revenue > 0 ? `S/ ${bestMonth.revenue.toFixed(0)}` : 'Sin ventas aún', color: 'var(--green)' },
    { label: year === thisYear ? 'Mes Actual' : `Dic ${year}`, val: `S/ ${(year === thisYear ? currentMonth : stats[11]).revenue.toFixed(0)}`, sub: `${(year === thisYear ? currentMonth : stats[11]).paid} pagados`, color: 'var(--gold-d)' },
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

function openExpenseModal(month, year) {
  let overlay = document.getElementById('expenseOverlay');
  if (overlay) overlay.remove();

  const expenses  = getExpenses(year).filter(e => e.month === month);
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
    btn.addEventListener('click', () => {
      const all         = getExpenses(year);
      const monthItems  = all.filter(e => e.month === month);
      const target      = monthItems[parseInt(btn.dataset.idx)];
      const newAll      = all.filter(e => e !== target);
      saveExpenses(year, newAll);
      showToast('Gasto eliminado ✓');
      overlay.remove();
      openExpenseModal(month, year);
    });
  });

  // Guardar gasto
  overlay.querySelector('#saveExpenseBtn').addEventListener('click', () => {
    const desc   = overlay.querySelector('#expenseDesc').value.trim();
    const amount = parseFloat(overlay.querySelector('#expenseAmount').value);
    if (!desc)               { showToast('Ingresa una descripción.'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('Ingresa un monto válido.'); return; }
    const all = getExpenses(year);
    all.push({ month, description: desc, amount, date: new Date().toISOString() });
    saveExpenses(year, all);
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
