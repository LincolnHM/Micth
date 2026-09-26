// ─── Modal de edición de pedido ───────────────────────────────────────────────

async function openEditOrderModal(id) {
  let order;
  try {
    order = await withTimeout(CloudOrders.getById(id), 12000, 'el pedido');
  } catch (err) {
    console.error('[MICHT] Error cargando pedido para editar:', err);
    showToast('⚠ Conexión lenta: no se pudo cargar el pedido para editar.');
    return;
  }
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
              <option value="recojo"   ${order.deliveryType==='recojo'  ?'selected':''}>🏪 Recojo</option>
              <option value="delivery" ${order.deliveryType==='delivery'?'selected':''}>🛵 Delivery Soritor</option>
              <option value="envio"    ${order.deliveryType==='envio'   ?'selected':''}>📦 Shalom</option>
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
  let allProducts;
  try {
    allProducts = await withTimeout(CloudProducts.getAll(), 12000, 'los productos');
  } catch (err) {
    console.error('[MICHT] Error cargando productos para editar pedido:', err);
    showToast('⚠ Conexión lenta: se muestran los productos guardados localmente.');
    allProducts = Products.getAll();
  }
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
            ? sizes.map(([s, p]) => `<option value="${escapeAttr(s)}|${Number(p) || 0}" ${s===item.size?'selected':''}>${sanitize(s)} — S/${Number(p) || 0}</option>`).join('')
            : `<option value="${escapeAttr(item.size||'')}|${Number(item.price) || 0}">${sanitize(item.size||'')} — S/${Number(item.price) || 0}</option>`}
        </select>
        <input type="number" class="edit-qty-inp" data-idx="${idx}" min="1" max="99" value="${parseInt(item.quantity) || 1}"
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
          <strong>${sanitize(o.brand)}</strong> — ${sanitize(o.productName)} <span style="color:var(--gold)">${sanitize(o.size)}</span> <span style="float:right">S/ ${Number(o.price) || 0}</span>
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
      // Si el pedido ya está pagado, cambiar productos/cantidades ajusta el stock por la diferencia
      const res = await CloudOrders.update(id, {
        customerName: name, customerPhone: phone, customerDni: dni,
        deliveryType: delivery, notes, items: editItems, total: newTotal
      });
      const stockNote = res.stock.length ? `\nStock ajustado: ${res.stock.join('; ')}` : '';
      showToast(`Pedido ${id} actualizado ✓${stockNote}`, res.stock.length ? 6500 : 2800);
      if (res.skipped.length) alert('⚠ Estos productos ya no existen en el catálogo y NO se les pudo mover el stock:\n\n' + res.skipped.join('\n'));
      closeModal();
      _statsCache = null;
      renderOrdersSection().catch(console.error);
      renderAdminProducts().catch(console.error);
    } catch (err) {
      console.error(err);
      alert('⚠ ' + (err.message || 'Error al guardar. Inténtalo de nuevo.'));
    } finally {
      saveBtn2.disabled    = false;
      saveBtn2.textContent = 'Guardar cambios';
    }
  });
}
