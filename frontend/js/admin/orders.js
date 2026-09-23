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

// Lista "• Marca Perfume: 15 ml" de lo que un pedido mueve en el inventario,
// sumada por perfume (para los diálogos de confirmar pago / devolver stock).
async function _orderStockLines(order) {
  let all;
  try { all = await withTimeout(CloudProducts.getAll(), 8000, 'los productos'); }
  catch { all = Products.getAll(); }
  const { needs } = orderStockNeeds(order.items, new Map(all.map(p => [p.id, p])));
  const prod = new Map(all.map(p => [p.id, p]));
  const lines = [];
  needs.forEach(n => {
    const p = prod.get(n.productId);
    const parts = [];
    if (n.ml) parts.push(p && p.bottleTotalMl > 0 ? `${n.ml} ml` : `${n.ml} ml (sin control de ml)`);
    if (n.units) parts.push(`${n.units} u.`);
    if (n.enteroUnits) parts.push(`${n.enteroUnits} u. (entero)`);
    if (parts.length) lines.push(`  • ${n.label}: ${parts.join(', ')}`);
  });
  const shown = lines.slice(0, 12).join('\n');
  return lines.length > 12 ? `${shown}\n  … y ${lines.length - 12} más` : shown;
}

async function renderOrdersSection() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:2rem">Cargando pedidos…</td></tr>';

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
      if (CloudOrders._divergent.length) {
        const ids = CloudOrders._divergent.slice(0, 6).map(d => `${sanitize(d.id)} (aquí: ${sanitize(d.local)}, base: ${sanitize(d.remote)})`).join(', ');
        diagBox.innerHTML += `<br><small style="color:#ffb74d">⚠ ${CloudOrders._divergent.length} pedido(s) tenían un estado distinto en este navegador que en Supabase; se muestra el de Supabase: ${ids}. Revisa que su stock esté bien.</small>`;
      }
    }
    // Antes se insertaba DENTRO de la <table> (HTML inválido: en el celular se encimaba con el encabezado)
    const tableWrap = tbody.closest('.orders-table-wrap') || tbody.parentElement;
    tableWrap.parentElement.insertBefore(diagBox, tableWrap);

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
        const id         = sel.dataset.id;
        const newStatus  = sel.value;
        const prevStatus = sel.dataset.status;

        const doUpdate = async (paymentMethod = null) => {
          try {
            const res = await CloudOrders.updateStatus(id, newStatus, paymentMethod);
            sel.dataset.status = newStatus;
            _statsCache = null;
            renderOrdersSection().catch(console.error);
            renderAdminProducts().catch(console.error);
            const _payLabels = { efectivo: '💵 Efectivo', yape: '📱 Yape', plin: '📲 Plin', transferencia: '🏦 Transferencia' };
            const payLabel = paymentMethod && _payLabels[paymentMethod] ? ` · ${_payLabels[paymentMethod]}` : '';
            const stockNote = res.stock.length ? `\nStock: ${res.stock.join('; ')}` : '';
            showToast(`Pedido ${id} → ${STATUS_LABELS[newStatus]}${payLabel}${stockNote}`, res.stock.length ? 6500 : 2800);
            if (res.skipped.length) alert('⚠ Estos productos ya no existen en el catálogo y NO se les pudo mover el stock:\n\n' + res.skipped.join('\n'));
          } catch (err) {
            console.error('Error al actualizar estado:', err);
            sel.value = prevStatus;
            alert('⚠ ' + (err.message || 'No se pudo actualizar el pedido. Inténtalo de nuevo.'));
          }
        };

        // Al pasar a "pagado" se descuenta stock; al salir de "pagado" se devuelve.
        // Se muestra exactamente qué se va a mover antes de confirmar.
        sel.value = prevStatus;
        const paying   = isPaidStatus(newStatus);
        const reverting = isPaidStatus(prevStatus) && !paying;
        CloudOrders.getById(id).then(async order => {
          const lines = order ? await _orderStockLines(order) : '';
          if (paying && !isPaidStatus(prevStatus)) {
            const info = lines ? `Stock a descontar:\n${lines}\n\n` : '';
            showPaymentModal(
              `${info}¿Cómo pagó el pedido ${id}?`,
              (payMethod) => { sel.value = newStatus; doUpdate(payMethod); },
              () => { sel.value = prevStatus; }
            );
          } else if (reverting) {
            const info = lines ? `Se devolverá al stock:\n${lines}\n\n` : '';
            showConfirmModal(
              `${info}¿Pasar el pedido ${id} de Pagado a ${STATUS_LABELS[newStatus]}?`,
              () => { sel.value = newStatus; doUpdate(); },
              () => { sel.value = prevStatus; }
            );
          } else {
            sel.value = newStatus; doUpdate();
          }
        }).catch(() => {
          if (paying && !isPaidStatus(prevStatus)) {
            showPaymentModal(
              `¿Cómo pagó el pedido ${id}?`,
              (payMethod) => { sel.value = newStatus; doUpdate(payMethod); },
              () => { sel.value = prevStatus; }
            );
          } else { sel.value = newStatus; doUpdate(); }
        });
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
        const isPaid = isPaidStatus(btn.closest('tr')?.querySelector('.order-action-select')?.dataset.status);
        // Eliminar solo borra el registro: NO devuelve stock. Para devolverlo, cambia el
        // estado a Cancelado (o Pendiente) y luego elimina si quieres.
        const warn = isPaid
          ? '\n\n⚠ Este pedido está PAGADO y ya descontó stock. Eliminarlo NO devuelve el stock ni deja rastro en la contabilidad. Si fue un error, cámbialo primero a Cancelado.'
          : '';
        showConfirmModal(
          `¿Eliminar el pedido ${id}? Esta acción no se puede deshacer.${warn}`,
          async () => {
            try {
              await CloudOrders.delete(id);
              _statsCache = null;
              renderOrdersSection().catch(console.error);
              showToast(`Pedido ${id} eliminado.`);
            } catch (err) {
              console.error(err);
              alert('⚠ ' + (err.message || 'Error al eliminar el pedido.'));
            }
          },
          () => {}
        );
      });
    });
  } catch (err) {
    console.error('[MICHT] renderOrdersSection falló:', err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:2rem">No se pudieron cargar los pedidos.</td></tr>';
  }
}

async function openOrderDetail(id) {
  let order;
  try {
    order = await withTimeout(CloudOrders.getById(id), 12000, 'el pedido');
  } catch (err) {
    console.error('[MICHT] Error cargando detalle de pedido:', err);
    showToast('⚠ Conexión lenta: no se pudo cargar el detalle del pedido.');
    return;
  }
  if (!order) return;
  const modal = document.getElementById('orderDetailModal');
  const body  = document.getElementById('orderDetailBody');

  const STATUS_LABELS = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };
  const date = new Date(order.date).toLocaleString('es-PE');

  body.innerHTML = `
    <div class="order-detail-row"><span class="lbl">ID Pedido</span><span class="val order-id">${sanitize(order.id)}</span></div>
    <div class="order-detail-row"><span class="lbl">Estado</span><span class="val"><span class="status-badge status-${String(order.status).replace(/[^a-z]/g, '')}">${STATUS_LABELS[order.status] ?? sanitize(order.status)}</span></span></div>
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
      <li style="display:flex;flex-direction:column;gap:.15rem;font-size:.82rem;color:var(--text2)">
        <div style="display:flex;justify-content:space-between">
          <span>${sanitize(i.brand || '')} ${sanitize(i.productName)} <span class="decant-chip">${sanitize(i.size)}</span> ×${parseInt(i.quantity) || 1}</span>
          <strong style="color:var(--gold)">S/ ${(i.price * i.quantity).toFixed(2)}</strong>
        </div>
        ${i.comboComposition ? `<span style="font-size:.72rem;color:var(--text3)">Incluye: ${sanitize(i.comboComposition)}</span>` : ''}
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
        style="width:100%;padding:.5rem .75rem;background:var(--bg);border:1px solid rgba(124,79,176,.3);border-radius:var(--r);color:var(--text);font-size:.82rem;resize:vertical;box-sizing:border-box;font-family:Inter,sans-serif;line-height:1.4;outline:none;transition:border-color .2s"
        onfocus="this.style.borderColor='var(--gold-d)'" onblur="this.style.borderColor='rgba(124,79,176,.3)'"
        placeholder="Ej: Falta pagar el saldo, cliente frecuente, etc.">${sanitize(getAdminNote(order.id))}</textarea>
      <button id="saveAdminNoteBtn" data-id="${escapeAttr(order.id)}"
        style="margin-top:.4rem;padding:.35rem .9rem;background:rgba(124,79,176,.12);color:var(--gold-d);border:1px solid rgba(124,79,176,.3);border-radius:var(--r);font-size:.75rem;font-weight:700;cursor:pointer;transition:background .15s"
        onmouseover="this.style.background='rgba(124,79,176,.22)'" onmouseout="this.style.background='rgba(124,79,176,.12)'">
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
  // En móvil, si el teclado virtual sigue abierto (foco en Notas/cantidad/etc.) al
  // tocar este botón, el toque primero cierra el teclado y desplaza el layout antes
  // de soltar el dedo — el navegador nunca sintetiza el "click" y el botón parece no
  // reaccionar. Se resuelve escuchando "touchend" directamente (mismo patrón ya usado
  // en las opciones del buscador de productos, más abajo en addOrderItemRow).
  (() => {
    const saveOrderBtnEl = document.getElementById('saveOrderBtn');
    if (!saveOrderBtnEl) return;
    let savedViaTouch = false;
    saveOrderBtnEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      savedViaTouch = true;
      saveManualOrder().catch(console.error);
    }, { passive: false });
    saveOrderBtnEl.addEventListener('click', () => {
      if (savedViaTouch) { savedViaTouch = false; return; }
      saveManualOrder().catch(console.error);
    });
  })();
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
    const orders = await withTimeout(CloudOrders.getAll(), 10000, 'el historial de clientes');
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
        <div class="cust-opt-name">${sanitize(c.name)}</div>
        <div class="cust-opt-meta">${c.phone ? '📞 ' + sanitize(c.phone) : ''}${c.dni ? ' · DNI ' + sanitize(c.dni) : ''}</div>
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
      _bindTapSelect(opt, selectCust);
    });
    dropdown.style.display = 'block';
    requestAnimationFrame(() => dropdown.scrollIntoView({ block: 'nearest' }));
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

  // searchWords: texto normalizado (sin acentos, sin emoji/precio) usado solo para
  // matchear la búsqueda — el "label" sigue siendo lo que se muestra tal cual.
  const buildSearchWords = (p, sizeLabel) =>
    _normalizeSearchText(`${p.brand} ${p.name} ${sizeLabel}`).split(/\s+/).filter(Boolean);

  // Perfumes Enteros (tipo entero)
  enteroProds.forEach(p => {
    Object.entries(p.sizes).forEach(([sizeLabel, price]) => {
      const priceStr = price > 0 ? `S/${price}` : 'Consultar';
      allOptions.push({
        value: `${p.id}|${sizeLabel}|${price}|${p.name}|${p.brand}`,
        label: `🛍 ENTERO · ${p.brand} – ${p.name} (${sizeLabel}) ${priceStr}`,
        searchWords: buildSearchWords(p, sizeLabel)
      });
    });
  });

  // Decants habilitados como entero (opción extra Unidad)
  decantProds.filter(p => (p.enteroStock || 0) > 0 && (p.enteroPrice || 0) > 0).forEach(p => {
    allOptions.push({
      value: `${p.id}|Unidad|${p.enteroPrice}|${p.name}|${p.brand}`,
      label: `🛍 ENTERO · ${p.brand} – ${p.name} (Unidad) S/${p.enteroPrice}`,
      searchWords: buildSearchWords(p, 'Unidad')
    });
  });

  // Decants normales (todos sus ml)
  decantProds.forEach(p => {
    Object.entries(p.sizes).forEach(([ml, price]) => {
      const priceStr = price > 0 ? `S/${price}` : 'Consultar';
      allOptions.push({
        value: `${p.id}|${ml}|${price}|${p.name}|${p.brand}`,
        label: `💧 Decant · ${p.brand} – ${p.name} (${ml}) ${priceStr}`,
        searchWords: buildSearchWords(p, ml)
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
    const q = _normalizeSearchText(filter);
    let matches;
    if (!q) {
      matches = allOptions.slice(0, 25);
    } else {
      const qWords = q.split(/\s+/).filter(Boolean);
      matches = allOptions
        .map(o => ({ o, score: _fuzzyMatchScore(qWords, o.searchWords) }))
        .filter(x => x.score !== null)
        .sort((a, b) => a.score - b.score)
        .slice(0, 25)
        .map(x => x.o);
    }

    if (!matches.length) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map(o =>
      `<div class="prod-opt" data-value="${escapeAttr(o.value)}" data-label="${escapeAttr(o.label)}"
            style="padding:.42rem .75rem;cursor:pointer;font-size:.82rem;color:var(--text2);border-bottom:1px solid var(--border);transition:background .12s"
            onmouseenter="this.style.background='var(--gold-dim)';this.style.color='var(--text)'"
            onmouseleave="this.style.background='';this.style.color='var(--text2)'">${sanitize(o.label)}</div>`
    ).join('');

    dropdown.style.display = 'block';
    // En móvil el modal es un contenedor con scroll — sin esto el dropdown puede
    // quedar recortado fuera del área visible si la fila está cerca del borde inferior.
    requestAnimationFrame(() => dropdown.scrollIntoView({ block: 'nearest' }));

    dropdown.querySelectorAll('.prod-opt').forEach(opt => {
      const selectProd = e => {
        e.preventDefault();
        hiddenInput.value  = opt.dataset.value;
        searchInput.value  = opt.dataset.label;
        dropdown.style.display = 'none';
      };
      // _bindTapSelect distingue un tap (selecciona) de un arrastre (scroll) — antes,
      // cualquier toque sobre una opción seleccionaba al instante y bloqueaba el
      // gesto de scroll, por lo que en móvil no se podía bajar la lista para ver
      // más resultados.
      _bindTapSelect(opt, selectProd);
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

  let allProds;
  try {
    allProds = await withTimeout(CloudProducts.getAll(), 12000, 'los productos');
  } catch (_) {
    allProds = Products.getAll();
  }

  // Validar stock con datos frescos de Supabase. Se suma por perfume: el mismo
  // perfume en dos tallas (ej. 3ml + 10ml) sale del mismo frasco.
  const stockErrors = stockShortages(items, new Map(allProds.map(p => [p.id, p]))).map(e =>
    e.type === 'agotado' ? `${e.name}: AGOTADO`
    : e.type === 'ml'    ? `${e.name}: solo quedan ~${e.remaining} ml (el pedido pide ${e.requested} ml en total)`
    :                      `${e.name}: solo quedan ${e.available} unidad(es) (el pedido pide ${e.requested})`
  );
  if (stockErrors.length) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar Pedido'; }
    alert('⚠ Stock insuficiente:\n\n' + stockErrors.join('\n') + '\n\nAjusta las cantidades antes de guardar.');
    return;
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  if (saveBtn) saveBtn.textContent = 'Guardando...';

  let orderId = null;
  try {
    // Siempre crear como 'pendiente' primero para que updateStatus pueda detectar el cambio
    // de estado y descontar el stock una sola vez (evita doble deducción)
    orderId = await withTimeout(
      CloudOrders.create({ customerName: name, customerPhone: phone, customerDni: dni, deliveryType: dtype, notes, items, total, paymentMethod: payMeth || null, status: 'pendiente' }),
      15000, 'el pedido'
    );

    // Si el admin registra el pedido directo como 'pagado', aplicar el descuento de stock
    // vía updateStatus (que también cambia el estado a 'pagado')
    let stockNote = '';
    if (initStat === 'pagado') {
      const res = await withTimeout(CloudOrders.updateStatus(orderId, 'pagado', payMeth || null), 20000, 'el estado del pedido');
      if (res.stock.length) stockNote = `\nStock: ${res.stock.join('; ')}`;
    }

    // Cerrar modal y mostrar éxito inmediatamente — el refresh es no-bloqueante
    document.getElementById('registerOrderModal').classList.remove('open');
    showToast('Pedido registrado correctamente ✓' + stockNote, stockNote ? 6500 : 2800);
    _statsCache = null;
    renderOrdersSection().catch(console.error);
    renderAdminProducts().catch(console.error);

  } catch (err) {
    console.error('[MICHT] Error guardando pedido:', err);
    if (orderId) {
      // El pedido SÍ se creó, pero no se pudo marcar como pagado / descontar el stock
      document.getElementById('registerOrderModal').classList.remove('open');
      renderOrdersSection().catch(console.error);
      alert(`⚠ El pedido ${orderId} se registró como PENDIENTE, pero no se pudo marcarlo como pagado:\n\n${err.message}\n\nMárcalo como pagado desde la lista cuando se resuelva.`);
    } else
    // El pedido ya se guarda en localStorage antes de intentar sincronizar con Supabase
    // (ver CloudOrders.create), así que un timeout de red no significa que se perdió.
    if (/Tiempo de espera agotado/.test(err?.message || '')) {
      document.getElementById('registerOrderModal').classList.remove('open');
      showToast('⚠ Conexión lenta: el pedido se guardó y se sincronizará cuando mejore la señal.');
      renderOrdersSection().catch(console.error);
    } else {
      showToast('Error al guardar el pedido. Inténtalo de nuevo.');
    }
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar Pedido'; }
  }
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
// ─── ETIQUETA DE ENVÍO ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function openShippingLabel(orderId) {
  let order;
  try {
    order = await withTimeout(CloudOrders.getById(orderId), 12000, 'el pedido');
  } catch (err) {
    console.error('[MICHT] Error cargando etiqueta de envío:', err);
    showToast('⚠ Conexión lenta: no se pudo cargar el pedido.');
    return;
  }
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
            <span>×${parseInt(i.quantity) || 1}</span>
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
  if (!win) { showToast('Activa las ventanas emergentes para imprimir la etiqueta.'); return; }
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
