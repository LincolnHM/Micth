// ─── Panel Administrador — MICHT Decants ─────────────────────────────────────

let _adminProductSearch = '';
let _adminProductTypeFilter = 'all';

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
      if (btn.dataset.section === 'inventory') renderInventorySection().catch(console.error);
      if (btn.dataset.section === 'orders')    renderOrdersSection().catch(console.error);
      if (btn.dataset.section === 'orders')    updateOrderStats().catch(console.error);
    });
  });
}

// ─── Sección: Productos ────────────────────────────────────────────────────────

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

  container.innerHTML = products.map(p => {
    const pct    = p.bottleTotalMl > 0 ? Math.round(p.bottleRemainingMl / p.bottleTotalMl * 100) : 0;
    const color  = pct > 50 ? '#4caf50' : pct > 20 ? '#ff9800' : '#ef5350';
    const typeLabel = p.type === 'arabe' ? 'Árabe' : p.type === 'entero' ? 'Entero' : 'Diseñador';
    const typeBadge = p.type === 'arabe' ? 'badge-arabe' : p.type === 'entero' ? 'badge-entero' : 'badge-dis';
    const gLabel    = { hombre: '♂ Hombre', mujer: '♀ Mujer', unisex: '⚥ Unisex' }[p.gender] || '';
    const isEntero  = p.type === 'entero';

    return `
    <div class="admin-card" data-id="${p.id}">
      <div class="admin-card-head">
        ${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(p.name)}" class="admin-product-thumb" loading="lazy" onerror="this.style.display='none'">` : ''}
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

function openRegisterOrderModal() {
  document.getElementById('regCustomerName').value  = '';
  document.getElementById('regCustomerPhone').value = '';
  document.getElementById('regCustomerDni').value   = '';
  document.getElementById('regDeliveryType').value  = 'recojo';
  document.getElementById('regNotes').value         = '';
  document.getElementById('regOrderItems').innerHTML = '';
  addOrderItemRow();
  document.getElementById('registerOrderModal').classList.add('open');
}

function addOrderItemRow() {
  const container = document.getElementById('regOrderItems');
  const products  = Products.getAll();

  // Construir lista completa de opciones (producto + talla)
  const allOptions = [];
  products.forEach(p => {
    Object.entries(p.sizes).forEach(([ml, price]) => {
      allOptions.push({
        value: `${p.id}|${ml}|${price}|${p.name}|${p.brand}`,
        label: `${p.brand} – ${p.name} (${ml}) S/${price}`
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

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const saveBtn = document.getElementById('saveOrderBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

  try {
    await CloudOrders.create({ customerName: name, customerPhone: phone, customerDni: dni, deliveryType: dtype, notes, items, total });
    document.getElementById('registerOrderModal').classList.remove('open');
    await renderOrdersSection();
    showToast('Pedido registrado correctamente ✓');
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
