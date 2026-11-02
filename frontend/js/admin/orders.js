// ─── Sección: Pedidos ─────────────────────────────────────────────────────────

let orderStatusFilter = 'all';

const ORDER_STATUS_LABELS = {
  pendiente: 'Pendiente', separado: 'Separado', pagado: 'Pagado',
  cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado'
};
const statusLabel = s => ORDER_STATUS_LABELS[s] ?? sanitize(String(s));

// Qué ofrece el selector de estado según el estado actual. "Separado" y "Pagado"
// abren la ventana de pago: el estado final sale de cuánto pagó.
const _STATUS_ORDER   = ['pendiente', 'separado', 'pagado', 'enviado', 'entregado', 'cancelado'];
const _STATUS_CHOICES = {
  pendiente: ['pendiente', 'separado', 'pagado', 'cancelado'],
  separado:  ['separado', 'pagado', 'pendiente', 'cancelado'],
  pagado:    ['pagado', 'pendiente', 'cancelado'],
  enviado:   ['enviado', 'pendiente', 'cancelado'],
  entregado: ['entregado', 'pendiente', 'cancelado'],
  cancelado: ['cancelado', 'pendiente']
};

// Ya empezó a pagar y le falta una parte (lo que se debe cobrar)
const orderOwes = o => o.status !== 'cancelado' && (o.payments || []).length > 0 && orderBalance(o) > 0;

const money = n => `S/ ${(Number(n) || 0).toFixed(2)}`;

// "📱 Yape S/ 50.00 + 💵 Efectivo S/ 30.00"
function paymentsText(payments) {
  return payments.map(p => {
    const m = PAYMENT_METHODS[p.method];
    return `${m ? `${m.icon} ${m.label}` : 'Sin método'} ${money(p.amount)}`;
  }).join(' + ');
}

// Chips de método de pago (sumados por método) para la tabla
function paymentChipsHtml(order) {
  const pays = orderPayments(order);
  if (!pays.length) return '';
  const byMethod = new Map();
  pays.forEach(p => byMethod.set(p.method || '', (byMethod.get(p.method || '') || 0) + p.amount));
  const showAmount = byMethod.size > 1 || orderBalance(order) > 0;
  return `<div class="pay-chips">${[...byMethod].map(([method, amount]) => {
    const m = PAYMENT_METHODS[method];
    const label = m ? `${m.icon} ${m.label}` : '⏳ Sin método';
    return `<span class="pay-badge pay-${method || 'none'}">${label}${showAmount ? ` ${money(amount)}` : ''}</span>`;
  }).join('')}</div>`;
}

// Etiqueta grande de entrega: ENVÍO / RECOJO / DELIVERY
function deliveryBadgeHtml(order) {
  const type = DELIVERY_TYPES[order.deliveryType] ? order.deliveryType : 'recojo';
  const info = deliveryInfo(type);
  const word = { envio: 'Envío', recojo: 'Recojo', delivery: 'Delivery' }[type];
  const sub  = type === 'envio'
    ? ['Shalom', [order.department, order.province].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')
    : type === 'delivery' ? 'Soritor' : 'En tienda';
  return `<span class="delivery-badge delivery-${type}">
      <span class="delivery-badge-icon" aria-hidden="true">${info.icon}</span>
      <span class="delivery-badge-text">${word}<small>${sanitize(sub)}</small></span>
    </span>`;
}

async function updateOrderStats(allOrders = null) {
  const bar = document.getElementById('orderStatsBar');
  if (!bar) return;
  try {
    const all = allOrders || await withTimeout(CloudOrders.getAll(), 15000, 'las estadísticas de pedidos');
    const count = s => all.filter(o => o.status === s).length;
    // Cobrado = todo el dinero recibido (adelantos incluidos); Por cobrar = saldos de los separados
    const cobrado   = incomePayments(all).reduce((s, p) => s + p.amount, 0);
    const porCobrar = all.filter(orderOwes).reduce((s, o) => s + orderBalance(o), 0);
    bar.innerHTML = `
      <div class="stat-card"><div class="stat-val" style="color:var(--gold)">${all.length}</div><div class="stat-label">Total</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--orange)">${count('pendiente')}</div><div class="stat-label">Pendientes</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#ffca28">${count('separado')}</div><div class="stat-label">Separados</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--green)">${count('pagado')}</div><div class="stat-label">Pagados</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#ef5350">${count('cancelado')}</div><div class="stat-label">Cancelados</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--gold-d)">S/${cobrado.toFixed(0)}</div><div class="stat-label">Cobrado</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#ffb74d">S/${porCobrar.toFixed(0)}</div><div class="stat-label">Por cobrar</div></div>
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
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem">Cargando pedidos…</td></tr>';

  try {
    // Una sola query a Supabase — se reutiliza para stats y tabla. Los datos de
    // Shalom van aparte; si no cargan, la lista sale igual.
    const shalomLoad = Promise.all([ShalomShipments.loadAll(), ClienteAdmin.sync()]).catch(() => {});
    let orders = await withTimeout(CloudOrders.getAll(), 15000, 'los pedidos');
    await withTimeout(shalomLoad, 8000, 'los datos de Shalom').catch(() => {});
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

    if (orderStatusFilter === 'saldo')    orders = orders.filter(orderOwes);
    else if (orderStatusFilter !== 'all') orders = orders.filter(o => o.status === orderStatusFilter);
    if (_orderSearch) {
      const q = _orderSearch.toLowerCase();
      orders = orders.filter(o =>
        (o.customerName  || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (o.customerDni   || '').includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (ShalomShipments.get(o.id)?.number || '').toLowerCase().includes(q)
      );
    }

    if (!orders.length) {
      const why = _orderSearch ? 'que coincidan con la búsqueda'
                : orderStatusFilter === 'saldo' ? 'con saldo por cobrar'
                : orderStatusFilter !== 'all' ? 'con ese estado' : 'registrados';
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem">No hay pedidos ${why}</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => {
    const date       = new Date(o.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const time       = new Date(o.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const delivType  = DELIVERY_TYPES[o.deliveryType] ? o.deliveryType : 'recojo';
    const safeStatus = o.status.replace(/[^a-z]/g, '');
    const choices    = _STATUS_ORDER.filter(s => (_STATUS_CHOICES[o.status] || _STATUS_CHOICES.pendiente).includes(s));
    const paid       = orderPaidAmount(o);
    const balance    = orderBalance(o);
    const owes       = orderOwes(o);

    const itemsHtml = (o.items || []).map(i =>
      `<div class="order-item-line">
        <span class="order-item-name">${sanitize((i.brand||'') + (i.brand && i.productName ? ' ' : '') + (i.productName||''))}</span>
        <span class="order-item-size-chip">${sanitize(i.size||'')} ×${parseInt(i.quantity)||1}</span>
      </div>`
    ).join('');

    // Pagó una parte: cuánto pagó y cuánto falta, con una barrita de avance
    const payProgress = owes ? `
        <div class="order-pay-progress" aria-hidden="true"><span style="width:${Math.min(100, Math.round(paid / (o.total || 1) * 100))}%"></span></div>
        <div class="order-pay-line">Pagó ${money(paid)}</div>
        <div class="order-pay-due">Falta ${money(balance)}</div>` : '';

    return `
    <tr class="order-row deliv-${delivType}">
      <td class="order-col-id">
        <span class="order-id">${sanitize(o.id)}</span>
        <div class="order-date" style="margin-top:.2rem">${date} · ${time}</div>
      </td>
      <td class="order-col-delivery">${deliveryBadgeHtml(o)}</td>
      <td class="order-col-client">
        <span class="order-customer">${sanitize(o.customerName || '—')}</span>
        ${o.customerPhone ? `<div class="order-date">${sanitize(o.customerPhone)}</div>` : ''}
        ${o.customerDni   ? `<div class="order-date" style="font-size:.68rem">DNI ${sanitize(o.customerDni)}</div>` : ''}
        ${delivType === 'envio' && o.status !== 'cancelado' && orderNeedsClientPhone(o)
          ? `<span class="order-phone-flag" title="Falta el número del cliente para mandarle su clave de Shalom">${ClienteAdmin.is(o.customerPhone) ? '👤 Cliente admin' : '📵 Sin número'}</span>` : ''}
      </td>
      <td class="order-col-items">
        <div class="order-items-list">${itemsHtml}</div>
      </td>
      <td class="order-col-total">
        <span class="order-total-cell">S/ ${o.total.toFixed(2)}</span>
        ${payProgress}
      </td>
      <td class="order-col-status">
        <span class="status-badge status-${safeStatus}">${statusLabel(o.status)}</span>
        ${o.status !== 'cancelado' ? paymentChipsHtml(o) : ''}
      </td>
      <td class="order-col-actions">
        <div class="order-actions-stack">
          <select class="order-action-select" data-id="${escapeAttr(o.id)}" data-status="${escapeAttr(o.status)}" aria-label="Cambiar estado">
            ${choices.map(s =>
              `<option value="${s}" ${o.status === s ? 'selected' : ''}>${ORDER_STATUS_LABELS[s]}</option>`
            ).join('')}
          </select>
          ${owes ? `<button class="btn-order-collect" data-id="${escapeAttr(o.id)}">💰 Cobrar ${money(balance)}</button>` : ''}
          ${shalomRowButtonHtml(o)}
          <div class="order-btn-row">
            <button class="btn-order-detail" data-id="${escapeAttr(o.id)}">Ver</button>
            <button class="btn-edit-order"   data-id="${escapeAttr(o.id)}">Editar</button>
            <button class="btn-delete-order" data-id="${escapeAttr(o.id)}" title="Eliminar pedido">✕</button>
          </div>
        </div>
      </td>
    </tr>`;
    }).join('');

    // Cambio de estado: "Separado" y "Pagado" abren la ventana de pago; "Pendiente" y
    // "Cancelado" piden confirmar si se devuelve stock o hay pagos anotados.
    tbody.querySelectorAll('.order-action-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id         = sel.dataset.id;
        const newStatus  = sel.value;
        sel.value = sel.dataset.status;   // vuelve atrás hasta que se confirme

        let order;
        try { order = await withTimeout(CloudOrders.getById(id), 12000, 'el pedido'); } catch { order = null; }
        if (!order) { alert('⚠ No se pudo cargar el pedido. Revisa tu conexión e inténtalo de nuevo.'); return; }

        if (newStatus === 'separado' || newStatus === 'pagado') openPaymentDialog(order, { target: newStatus });
        else confirmStatusChange(order, newStatus);
      });
    });

    // Cobrar el saldo de un pedido separado
    tbody.querySelectorAll('.btn-order-collect').forEach(btn => {
      btn.addEventListener('click', async () => {
        let order;
        try { order = await withTimeout(CloudOrders.getById(btn.dataset.id), 12000, 'el pedido'); } catch { order = null; }
        if (!order) { alert('⚠ No se pudo cargar el pedido. Revisa tu conexión e inténtalo de nuevo.'); return; }
        openPaymentDialog(order);
      });
    });

    // Datos de Shalom y WhatsApp al cliente
    tbody.querySelectorAll('.btn-order-shalom').forEach(btn => {
      btn.addEventListener('click', () => openShalomDialog(btn.dataset.id).catch(console.error));
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
        const status = btn.closest('tr')?.querySelector('.order-action-select')?.dataset.status;
        // Eliminar solo borra el registro: NO devuelve stock. Para devolverlo, cambia el
        // estado a Cancelado (o Pendiente) y luego elimina si quieres.
        const warn = isPaidStatus(status)
          ? `\n\n⚠ Este pedido está ${statusLabel(status).toUpperCase()} y ya descontó stock. Eliminarlo NO devuelve el stock y sus pagos dejan de contar en Caja y Contabilidad. Si fue un error, cámbialo primero a Cancelado.`
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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem">No se pudieron cargar los pedidos.</td></tr>';
  }
}

// Después de un cambio de estado o de pagos: avisar y refrescar todo
function _afterOrderChange(id, res, extra = '') {
  _statsCache = null;
  renderOrdersSection().catch(console.error);
  renderAdminProducts().catch(console.error);
  const st = res.order ? ` → ${statusLabel(res.order.status)}` : '';
  const due = res.order && orderOwes(res.order) ? ` · falta ${money(orderBalance(res.order))}` : '';
  const stockNote = res.stock.length ? `\nStock: ${res.stock.join('; ')}` : '';
  showToast(`${extra || 'Pedido ' + id}${st}${due}${stockNote}`, res.stock.length ? 6500 : 3200);
  if (res.skipped.length) alert('⚠ Estos productos ya no existen en el catálogo y NO se les pudo mover el stock:\n\n' + res.skipped.join('\n'));
}

// Pasar a Pendiente o Cancelado (o reactivar un cancelado). Confirma antes si se
// devuelve stock o hay pagos anotados.
async function confirmStatusChange(order, newStatus) {
  if (order.status === newStatus) return;
  const pays = orderPayments(order);
  const msgs = [];
  if (isPaidStatus(order.status)) {
    const lines = await _orderStockLines(order);
    if (lines) msgs.push(`Se devolverá al stock:\n${lines}`);
  }
  if (newStatus === 'pendiente' && pays.length) {
    msgs.push(`Se borrarán los pagos anotados (${paymentsText(pays)}). Úsalo solo si fue un error.`);
  }
  if (newStatus === 'cancelado' && pays.length) {
    msgs.push(`Los pagos anotados (${paymentsText(pays)}) se quedan en el detalle, pero dejan de contar en Caja y Contabilidad (como si se los hubieras devuelto).`);
  }

  const run = async () => {
    try {
      const res = await withTimeout(CloudOrders.updateStatus(order.id, newStatus), 20000, 'el estado del pedido');
      _afterOrderChange(order.id, res);
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('⚠ ' + (err.message || 'No se pudo actualizar el pedido. Inténtalo de nuevo.'));
    }
  };
  if (!msgs.length) return run();
  showConfirmModal(`${msgs.join('\n\n')}\n\n¿Pasar el pedido ${order.id} de ${statusLabel(order.status)} a ${statusLabel(newStatus)}?`, run, () => {});
}

// ─── Ventana "Registrar pago" ─────────────────────────────────────────────────
// Sirve para todo: pago completo, adelanto (separación), saldo, y pagos divididos
// (ej. Yape S/ 50 + efectivo S/ 30). El estado sale de lo pagado: una parte →
// Separado (ya descuenta stock), todo → Pagado.
//   target: 'separado' | 'pagado' | null — solo cambia el texto de ayuda
function openPaymentDialog(order, { target = null, onDone = null } = {}) {
  if (order.status === 'cancelado') {
    alert('Este pedido está cancelado. Pásalo a Pendiente antes de registrar un pago.');
    return;
  }
  const id      = order.id;
  const paid    = orderPaidAmount(order);
  const balance = orderBalance(order);

  if (balance <= 0) {
    // Nada que cobrar (total S/ 0, o ya está cubierto): solo falta marcarlo pagado
    if (order.status === 'pagado') { showToast('Este pedido ya está pagado completo.'); return; }
    showConfirmModal(`El pedido ${id} no tiene saldo por cobrar. ¿Marcarlo como Pagado?`, async () => {
      try { _afterOrderChange(id, await CloudOrders.updateStatus(id, 'pagado')); }
      catch (err) { alert('⚠ ' + (err.message || 'No se pudo actualizar el pedido.')); }
    }, () => {});
    return;
  }

  const methodRow = key => {
    const m = PAYMENT_METHODS[key];
    return `
      <div class="paydlg-row">
        <label class="paydlg-method" for="paydlg-${key}">${m.icon} ${m.label}</label>
        <div class="paydlg-input"><span aria-hidden="true">S/</span>
          <input id="paydlg-${key}" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-method="${key}">
        </div>
        <button type="button" class="paydlg-fill" data-method="${key}" title="Poner aquí todo lo que falta">Todo</button>
      </div>`;
  };
  const hint = target === 'separado'
    ? 'Escribe el adelanto que dejó. Si pagó con dos métodos, llena los dos.'
    : 'Si pagó una parte con Yape y otra en efectivo, llena los dos.';

  const overlay = document.createElement('div');
  overlay.className = 'paydlg-overlay';
  overlay.innerHTML = `
    <div class="paydlg" role="dialog" aria-modal="true" aria-labelledby="paydlgTitle">
      <div class="paydlg-head">
        <h3 id="paydlgTitle">${target === 'separado' ? 'Separar con adelanto' : 'Registrar pago'}</h3>
        <button type="button" class="paydlg-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="paydlg-body">
        <div class="paydlg-order">
          <div>
            <span class="order-id">${sanitize(id)}</span>
            <div class="paydlg-customer">${sanitize(order.customerName || '—')}</div>
          </div>
          ${deliveryBadgeHtml(order)}
        </div>
        <div class="paydlg-summary">
          <div><span>Total</span><strong>${money(order.total)}</strong></div>
          <div><span>Ya pagó</span><strong>${money(paid)}</strong></div>
          <div class="paydlg-due"><span>Falta</span><strong>${money(balance)}</strong></div>
        </div>
        <p class="paydlg-question">¿Cuánto pagó y cómo?<small>${hint}</small></p>
        <div class="paydlg-methods">
          ${methodRow('yape')}
          ${methodRow('efectivo')}
          <div class="paydlg-more" hidden>${methodRow('plin')}${methodRow('transferencia')}</div>
          <button type="button" class="paydlg-more-btn">+ Plin / Transferencia</button>
        </div>
        <div class="field">
          <label for="paydlgNote">Nota (opcional)</label>
          <input id="paydlgNote" type="text" maxlength="120" placeholder="${target === 'separado' ? 'Ej: separación, paga el resto al enviar' : 'Ej: saldo al enviar'}">
        </div>
        <div class="paydlg-result" aria-live="polite"></div>
        <div class="paydlg-stock" hidden></div>
      </div>
      <div class="paydlg-foot">
        <button type="button" class="btn-cancel paydlg-cancel">Cancelar</button>
        <button type="button" class="btn-save paydlg-save" disabled>Guardar pago</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const inputs  = [...overlay.querySelectorAll('.paydlg-input input')];
  const result  = overlay.querySelector('.paydlg-result');
  const saveBtn = overlay.querySelector('.paydlg-save');
  const more    = overlay.querySelector('.paydlg-more');
  const moreBtn = overlay.querySelector('.paydlg-more-btn');

  // "40", "40.5", "40,50" o "S/ 40" → número; vacío → 0; otra cosa → NaN
  const parseAmount = v => {
    const t = String(v).trim().replace(/^s\/\s*/i, '').replace(',', '.');
    if (!t) return 0;
    return /^\d+(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN;
  };
  const entries = () => inputs.map(inp => ({ method: inp.dataset.method, amount: parseAmount(inp.value) }));

  const recalc = () => {
    const list = entries();
    const sum  = roundMoney(list.reduce((s, e) => s + (Number.isNaN(e.amount) ? 0 : e.amount), 0));
    let cls = 'muted', text = 'Escribe cuánto pagó (o toca «Todo» al lado del método).', ok = false;
    if (list.some(e => Number.isNaN(e.amount))) {
      cls = 'error'; text = 'Revisa los montos: solo números, por ejemplo 40 o 40.50';
    } else if (sum > balance + 0.005) {
      cls = 'error'; text = `Es más de lo que falta pagar (${money(balance)}).`;
    } else if (sum >= balance - 0.005) {
      cls = 'ok'; ok = true; text = `Recibes ${money(sum)} → el pedido queda <strong>PAGADO</strong> ✓`;
    } else if (sum > 0) {
      cls = 'warn'; ok = true; text = `Recibes ${money(sum)} → queda <strong>SEPARADO</strong> · faltará ${money(balance - sum)}`;
    }
    result.className = `paydlg-result ${cls}`;
    result.innerHTML = text;
    saveBtn.disabled = !ok;
  };
  inputs.forEach(inp => inp.addEventListener('input', recalc));

  // "Todo": pone en ese método lo que falta, descontando lo escrito en los otros
  overlay.querySelectorAll('.paydlg-fill').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = inputs.find(i => i.dataset.method === btn.dataset.method);
      const others = entries().filter(e => e.method !== btn.dataset.method && !Number.isNaN(e.amount))
                              .reduce((s, e) => s + e.amount, 0);
      const rest = roundMoney(balance - others);
      inp.value = rest > 0 ? rest.toFixed(2) : '';
      recalc();
    });
  });
  moreBtn.addEventListener('click', () => { more.hidden = false; moreBtn.remove(); });

  // Si el pedido aún no descontó stock, mostrar qué se va a descontar
  if (!isPaidStatus(order.status)) {
    _orderStockLines(order).then(lines => {
      if (!lines || !overlay.isConnected) return;
      const box = overlay.querySelector('.paydlg-stock');
      box.textContent = `Al guardar se descuenta del stock (el perfume queda apartado):\n${lines}`;
      box.hidden = false;
    }).catch(() => {});
  }

  const close = () => {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 220);
  };
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter' && !saveBtn.disabled && overlay.contains(document.activeElement)) save();
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.paydlg-close').addEventListener('click', close);
  overlay.querySelector('.paydlg-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  let saving = false;
  async function save() {
    if (saving || saveBtn.disabled) return;
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    const note = overlay.querySelector('#paydlgNote').value.trim();
    const list = entries().filter(e => e.amount > 0).map(e => ({ ...e, note }));
    try {
      const res = await withTimeout(CloudOrders.addPayments(id, list), 20000, 'el pago');
      close();
      _afterOrderChange(id, res, `Pago registrado: ${paymentsText(list)}`);
      if (onDone) onDone(res);
    } catch (err) {
      console.error('[MICHT] Error registrando pago:', err);
      alert('⚠ ' + (err.message || 'No se pudo registrar el pago. Inténtalo de nuevo.'));
      saving = false;
      saveBtn.textContent = 'Guardar pago';
      recalc();
    }
  }
  saveBtn.addEventListener('click', save);

  recalc();
  if (!('ontouchstart' in window)) inputs[0].focus();
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
  const shalom = order.deliveryType === 'envio'
    ? await withTimeout(ShalomShipments.load(order.id), 8000, 'los datos de Shalom').catch(() => ShalomShipments.get(order.id))
    : null;
  const shortDate = d => new Date(d).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const date = new Date(order.date).toLocaleString('es-PE');
  const pays      = orderPayments(order);
  const paid      = orderPaidAmount(order);
  const balance   = orderBalance(order);
  const cancelled = order.status === 'cancelado';
  const payDate   = shortDate;
  const methodOptions = p => (p.method ? '' : '<option value="" selected>⏳ Sin método</option>') +
    Object.entries(PAYMENT_METHODS).map(([k, m]) => `<option value="${k}" ${p.method === k ? 'selected' : ''}>${m.icon} ${m.label}</option>`).join('');

  body.innerHTML = `
    <div class="order-detail-top">
      ${deliveryBadgeHtml(order)}
      <span class="status-badge status-${String(order.status).replace(/[^a-z]/g, '')}">${statusLabel(order.status)}</span>
    </div>
    <div class="order-detail-row"><span class="lbl">ID Pedido</span><span class="val order-id">${sanitize(order.id)}</span></div>
    <div class="order-detail-row"><span class="lbl">Fecha</span><span class="val">${date}</span></div>
    <div class="order-pay-section">
      <div class="order-pay-head">
        <span>💰 Pagos</span>
        ${!cancelled && balance > 0 ? `<button type="button" id="detAddPaymentBtn" class="btn-order-collect">+ Registrar pago</button>` : ''}
      </div>
      ${pays.length ? pays.map(p => `
      <div class="pay-row">
        <span class="pay-row-date">${p.legacy ? 'Pago completo' : payDate(p.date)}</span>
        <select class="pay-row-method" data-pid="${escapeAttr(p.id)}" aria-label="Método de este pago">${methodOptions(p)}</select>
        <strong class="pay-row-amount">${money(p.amount)}</strong>
        ${p.legacy ? '<span></span>' : `<button type="button" class="pay-row-del" data-pid="${escapeAttr(p.id)}" title="Quitar este pago (si lo anotaste por error)" aria-label="Quitar este pago">✕</button>`}
        ${p.note ? `<div class="pay-row-note">${sanitize(p.note)}</div>` : ''}
      </div>`).join('') : '<p class="order-pay-empty">Todavía no pagó nada.</p>'}
      <div class="order-pay-totals">
        <span>Pagado <strong>${money(paid)}</strong> de ${money(order.total)}</span>
        ${balance > 0 && pays.length ? `<span class="order-pay-due">Falta ${money(balance)}</span>`
          : balance <= 0 && pays.length ? '<span class="order-pay-ok">✓ Pagado completo</span>' : ''}
      </div>
      ${cancelled && pays.length ? '<p class="order-pay-note">Pedido cancelado: estos pagos ya no cuentan en Caja ni Contabilidad.</p>' : ''}
    </div>
    <hr style="border-color:var(--border)">
    <div class="order-detail-row"><span class="lbl">Cliente</span><span class="val">${sanitize(order.customerName || '—')}</span></div>
    <div class="order-detail-row"><span class="lbl">DNI</span><span class="val">${sanitize(order.customerDni || '—')}</span></div>
    <div class="order-detail-row"><span class="lbl">Teléfono</span><span class="val">${sanitize(order.customerPhone || '—')}</span></div>
    <hr style="border-color:var(--border)">
    <div class="order-detail-row"><span class="lbl">Entrega</span><span class="val">${deliveryInfo(order.deliveryType).icon} ${deliveryInfo(order.deliveryType).long}</span></div>
    ${order.deliveryType === 'delivery' ? `
    <div class="order-detail-row"><span class="lbl">Dirección</span><span class="val">${sanitize(order.shalomOffice || '—')}</span></div>
    ` : ''}
    ${order.deliveryType === 'envio' ? `
    <div class="order-detail-row"><span class="lbl">Dpto / Prov</span><span class="val">${sanitize(order.department || '')} / ${sanitize(order.province || '')}</span></div>
    <div class="order-detail-row"><span class="lbl">Agencia Shalom</span><span class="val">${sanitize(order.shalomOffice || '—')}</span></div>
    <div class="order-detail-row"><span class="lbl">Orden Shalom</span><span class="val">${shalom
      ? `N° ${sanitize(shalom.number || '—')} · Código ${sanitize(shalom.code || '—')} · Clave ${sanitize(shalom.password || '—')}`
      : 'Sin datos todavía'}</span></div>
    ${shalom?.notifiedAt ? `<div class="order-detail-row"><span class="lbl">Aviso al cliente</span><span class="val">✓ Enviado por WhatsApp el ${shortDate(shalom.notifiedAt)}</span></div>` : ''}
    ${shalomRowButtonHtml(order)}
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
            style="padding:.4rem .9rem;background:var(--gold);color:#fff;border:none;border-radius:var(--r);font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s"
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
        placeholder="Ej: cliente frecuente, coordinar hora de recojo, etc.">${sanitize(getAdminNote(order.id))}</textarea>
      <button id="saveAdminNoteBtn" data-id="${escapeAttr(order.id)}"
        style="margin-top:.4rem;padding:.35rem .9rem;background:rgba(124,79,176,.12);color:var(--gold-d);border:1px solid rgba(124,79,176,.3);border-radius:var(--r);font-size:.75rem;font-weight:700;cursor:pointer;transition:background .15s"
        onmouseover="this.style.background='rgba(124,79,176,.22)'" onmouseout="this.style.background='rgba(124,79,176,.12)'">
        Guardar nota
      </button>
    </div>
    ${order.deliveryType === 'envio' ? `
    ${orderOwes(order) ? `<p class="order-ship-warn">⚠ Falta cobrar ${money(balance)} antes de enviar.</p>` : ''}
    <button id="openShippingLabelBtn" data-id="${escapeAttr(order.id)}"
      style="margin-top:.25rem;width:100%;padding:.55rem;background:rgba(33,150,243,.1);color:#64b5f6;border:1px solid rgba(33,150,243,.25);border-radius:var(--r);font-size:.82rem;font-weight:700;cursor:pointer;transition:background .15s"
      onmouseover="this.style.background='rgba(33,150,243,.18)'" onmouseout="this.style.background='rgba(33,150,243,.1)'">
      🖨 Imprimir etiqueta de envío
    </button>` : ''}
  `;

  const reopen = () => openOrderDetail(order.id).catch(console.error);

  // Datos de Shalom y WhatsApp al cliente
  body.querySelector('.btn-order-shalom')?.addEventListener('click', () => {
    openShalomDialog(order.id, { onDone: reopen }).catch(console.error);
  });

  // Registrar un pago desde el detalle
  body.querySelector('#detAddPaymentBtn')?.addEventListener('click', () => {
    openPaymentDialog(order, { onDone: reopen });
  });

  // Corregir el método de un pago (ej. se anotó Yape y fue efectivo)
  body.querySelectorAll('.pay-row-method').forEach(sel => {
    const before = sel.value;
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      try {
        await withTimeout(CloudOrders.setPaymentMethod(order.id, sel.dataset.pid, sel.value), 15000, 'el pago');
        _statsCache = null;
        showToast(`Método de pago corregido: ${PAYMENT_METHODS[sel.value]?.label || 'sin método'} ✓`);
        renderOrdersSection().catch(console.error);
        reopen();
      } catch (err) {
        sel.value = before;
        sel.disabled = false;
        alert('⚠ ' + (err.message || 'No se pudo cambiar el método de pago.'));
      }
    });
  });

  // Quitar un pago anotado por error
  body.querySelectorAll('.pay-row-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = order.payments.find(x => x.id === btn.dataset.pid);
      if (!p) return;
      const left = roundMoney(paid - p.amount);
      let next = cancelled ? 'cancelado' : statusForPaid(left, order.total);
      if (['enviado', 'entregado'].includes(order.status) && left > 0) next = order.status;
      let msg = `¿Quitar el pago de ${paymentsText([p])}?`;
      if (next !== order.status) {
        msg += `\n\nEl pedido pasa de ${statusLabel(order.status)} a ${statusLabel(next)}.`;
        if (isPaidStatus(order.status) && !isPaidStatus(next)) {
          const lines = await _orderStockLines(order);
          if (lines) msg += `\n\nSe devolverá al stock:\n${lines}`;
        }
      }
      showConfirmModal(msg, async () => {
        try {
          const res = await withTimeout(CloudOrders.removePayment(order.id, p.id), 20000, 'el pago');
          _afterOrderChange(order.id, res, 'Pago quitado');
          reopen();
        } catch (err) {
          alert('⚠ ' + (err.message || 'No se pudo quitar el pago.'));
        }
      }, () => {});
    });
  });

  // Guardar nuevo total (si el pedido tiene pagos, su estado se ajusta a lo pagado)
  body.querySelector('#saveOrderTotalBtn')?.addEventListener('click', async () => {
    const btn   = body.querySelector('#saveOrderTotalBtn');
    const input = body.querySelector('#orderTotalInput');
    const typed = parseFloat(input.value);

    if (isNaN(typed) || typed < 0) {
      showToast('Ingresa un total válido mayor a 0.');
      return;
    }
    const newTotal = roundMoney(typed);

    btn.disabled    = true;
    btn.textContent = 'Guardando…';

    try {
      await withTimeout(CloudOrders.update(order.id, { total: newTotal }), 20000, 'el total');
      _statsCache = null;
      showToast(`Total del pedido ${order.id} actualizado a S/ ${newTotal.toFixed(2)} ✓`);
      renderOrdersSection().catch(console.error);
      reopen();
    } catch (err) {
      console.error('Error al actualizar total:', err);
      showToast('Error al guardar. Intenta de nuevo.');
      btn.disabled    = false;
      btn.textContent = 'Guardar';
    }
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
  document.getElementById('regPayNow').value        = 'no';
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
  const payNow   = document.getElementById('regPayNow')?.value === 'si';
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
    // Siempre se crea como 'pendiente'. Si ya pagó, el pago se anota justo después en
    // la ventana "Registrar pago", que también descuenta el stock una sola vez.
    orderId = await withTimeout(
      CloudOrders.create({ customerName: name, customerPhone: phone, customerDni: dni, deliveryType: dtype, notes, items, total, paymentMethod: null, status: 'pendiente' }),
      15000, 'el pedido'
    );

    // Cerrar modal y mostrar éxito inmediatamente — el refresh es no-bloqueante
    document.getElementById('registerOrderModal').classList.remove('open');
    _statsCache = null;
    renderOrdersSection().catch(console.error);

    if (payNow) {
      showToast('Pedido registrado ✓ Ahora anota cuánto pagó.');
      const order = await withTimeout(CloudOrders.getById(orderId), 12000, 'el pedido').catch(() => null);
      if (order) openPaymentDialog(order);
      else alert(`El pedido ${orderId} se registró como PENDIENTE. Anota el pago desde la lista (Estado → Pagado o Separado).`);
    } else {
      showToast('Pedido registrado correctamente ✓');
    }

  } catch (err) {
    console.error('[MICHT] Error guardando pedido:', err);
    if (orderId) {
      document.getElementById('registerOrderModal').classList.remove('open');
      renderOrdersSection().catch(console.error);
      alert(`⚠ El pedido ${orderId} se registró como PENDIENTE, pero algo falló después:\n\n${err.message}`);
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
