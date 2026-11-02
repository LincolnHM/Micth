// ═══════════════════════════════════════════════════════════════════════════════
// ─── VENDEDORAS (vista del admin) — Contabilidad ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Resumen por vendedora: cuánto vendió en el mes y cuánto dinero tiene todavía
// (lo que cobró y aún no te entregó). "Recibí dinero" marca esos pedidos como
// entregados (rendido_at). Sin comisiones. Necesita
// backend/supabase/sql/2026-11-02-vendedoras.sql; sin él la tarjeta no aparece.

let _saMonth = null;   // 'AAAA-MM'

function _saMonthKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

async function renderSellersAccounting() {
  const box = document.getElementById('sellersAccounting');
  if (!box || !db) return;

  const { data: sellers, error } = await db.from('vendedoras').select('user_id, nombre, activa').order('nombre');
  if (error) { box.hidden = true; return; }         // aún no se corrió el SQL
  const orders = await CloudOrders.getAll().catch(() => []);
  const sellerOrders = orders.filter(o => o.vendedoraId);
  if (!sellers.length && !sellerOrders.length) { box.hidden = true; return; }
  box.hidden = false;

  // Meses con ventas de vendedoras + el actual
  const months = new Set([_saMonthKey(new Date()), ...sellerOrders.map(o => _saMonthKey(o.date))]);
  const monthList = [...months].sort().reverse();
  if (!_saMonth || !months.has(_saMonth)) _saMonth = monthList[0];
  const monthLabel = k => {
    const [y, m] = k.split('-');
    const t = new Date(+y, +m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);                 // "Noviembre de 2026"
  };

  // Una fila por vendedora (también las que ya no están activas pero tienen ventas)
  const rows = new Map(sellers.map(s => [s.user_id, { id: s.user_id, name: s.nombre, active: s.activa }]));
  sellerOrders.forEach(o => { if (!rows.has(o.vendedoraId)) rows.set(o.vendedoraId, { id: o.vendedoraId, name: o.vendedoraNombre || 'Vendedora', active: false }); });

  const units = o => flattenOrderItems(o.items).reduce((s, i) => s + (parseInt(i.quantity) || 1), 0);
  const stats = [...rows.values()].map(r => {
    const mine    = sellerOrders.filter(o => o.vendedoraId === r.id);
    const inMonth = mine.filter(o => _saMonthKey(o.date) === _saMonth);
    const valid   = inMonth.filter(o => o.status !== 'cancelado');
    const pending = mine.filter(o => o.status !== 'cancelado' && !o.rendidoAt);
    return {
      ...r,
      orders:   valid.length,
      units:    valid.reduce((s, o) => s + units(o), 0),
      sold:     valid.reduce((s, o) => s + o.total, 0),
      voided:   inMonth.filter(o => o.anuladoVendedoraAt).length,
      pending,
      owes:     pending.reduce((s, o) => s + orderPaidAmount(o), 0),
    };
  });

  box.innerHTML = `
    <div class="sa-head">
      <h3>🛍 Vendedoras</h3>
      <select id="saMonth" aria-label="Mes">
        ${monthList.map(k => `<option value="${k}" ${k === _saMonth ? 'selected' : ''}>${sanitize(monthLabel(k))}</option>`).join('')}
      </select>
    </div>
    <div class="sa-grid">
      ${stats.map(s => `
      <div class="sa-card">
        <div class="sa-card-top">
          <strong>${sanitize(s.name)}</strong>
          ${s.active ? '' : '<span class="sa-off">Sin acceso</span>'}
        </div>
        <div class="sa-nums">
          <div><span>Vendido</span><b>${money(s.sold)}</b></div>
          <div><span>Pedidos</span><b>${s.orders}</b></div>
          <div><span>Productos</span><b>${s.units}</b></div>
        </div>
        ${s.voided ? `<p class="sa-note">⚠ Anuló ${s.voided} ${s.voided === 1 ? 'venta' : 'ventas'} este mes.</p>` : ''}
        <div class="sa-owe ${s.owes > 0 ? '' : 'is-zero'}">
          <span>Tiene por entregarte</span>
          <b>${money(s.owes)}</b>
          ${s.owes > 0 ? `<button type="button" class="btn-order-collect sa-receive" data-id="${escapeAttr(s.id)}">Recibí dinero</button>` : '<small>Al día ✓</small>'}
        </div>
      </div>`).join('')}
    </div>`;

  box.querySelector('#saMonth').addEventListener('change', e => { _saMonth = e.target.value; renderSellersAccounting().catch(console.error); });
  box.querySelectorAll('.sa-receive').forEach(b => b.addEventListener('click', () => {
    const s = stats.find(x => x.id === b.dataset.id);
    if (s) _saOpenReceive(s);
  }));
}

// Elegir qué ventas te entregó (por defecto todas) y marcarlas
function _saOpenReceive(s) {
  const overlay = document.createElement('div');
  overlay.className = 'sa-overlay';
  overlay.innerHTML = `
    <div class="sa-modal" role="dialog" aria-modal="true" aria-label="Dinero recibido de ${escapeAttr(s.name)}">
      <h3>Dinero recibido de ${sanitize(s.name)}</h3>
      <p class="sa-note">Marca las ventas cuyo dinero ya te entregó.</p>
      <div class="sa-list">
        ${s.pending.map(o => `
        <label class="sa-item">
          <input type="checkbox" value="${escapeAttr(o.id)}" data-amount="${orderPaidAmount(o)}" checked>
          <span>${new Date(o.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} · ${sanitize(o.customerName || '—')}
            <small>${(o.payments || []).map(p => PAYMENT_METHODS[p.method]?.label || '').filter(Boolean).join(', ')}</small></span>
          <b>${money(orderPaidAmount(o))}</b>
        </label>`).join('')}
      </div>
      <div class="sa-modal-foot">
        <button type="button" class="btn-cancel" data-act="cancel">Cancelar</button>
        <button type="button" class="btn-save" data-act="ok">Recibí ${money(s.owes)}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const okBtn = overlay.querySelector('[data-act="ok"]');
  const checked = () => [...overlay.querySelectorAll('input[type=checkbox]:checked')];
  const refresh = () => {
    const sum = checked().reduce((t, c) => t + (parseFloat(c.dataset.amount) || 0), 0);
    okBtn.textContent = `Recibí ${money(sum)}`;
    okBtn.disabled = !checked().length;
  };
  overlay.addEventListener('change', refresh);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);
  okBtn.addEventListener('click', async () => {
    const ids = checked().map(c => c.value);
    if (!ids.length) return;
    okBtn.disabled = true;
    const now = new Date().toISOString();
    const { data, error } = await db.from('pedidos')
      .update({ rendido_at: now, updated_at: now })
      .in('id', ids).is('rendido_at', null)
      .select('id');
    if (error) { alert('⚠ No se pudo guardar: ' + (error.message || error.code)); okBtn.disabled = false; return; }
    close();
    showToast(`✓ Recibido: ${data?.length || 0} ${data?.length === 1 ? 'venta' : 'ventas'} de ${s.name}`);
    renderSellersAccounting().catch(console.error);
  });
}
