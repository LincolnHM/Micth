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

        <!-- Stock de "entero" para decants: frascos sellados aparte del que se -->
        <!-- usa para sacar decants — cantidad real, no un simple sí/no. -->
        ${!isEntero ? `
        <div class="admin-info-row" style="align-items:center;gap:.6rem;flex-wrap:wrap">
          <strong style="font-size:.76rem;color:var(--text2)">Frascos enteros en stock:</strong>
          <div style="display:flex;align-items:center;gap:.5rem">
            <input type="number" class="entero-stock-input" data-id="${p.id}"
                   value="${p.enteroStock || 0}" min="0" max="99" step="1"
                   style="width:56px;background:transparent;border:none;border-bottom:1px solid var(--border-l);color:var(--text);font-size:.82rem;font-weight:600;padding:.1rem .2rem;outline:none;text-align:right"
                   onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border-l)'">
            <button class="btn-save-entero-stock" data-id="${p.id}"
                    style="font-size:.72rem;padding:.3rem .75rem;background:var(--gold);color:#111;border:none;border-radius:var(--r);font-weight:700;cursor:pointer;transition:background .2s"
                    onmouseover="this.style.background='var(--gold-l)'" onmouseout="this.style.background='var(--gold)'">
              Guardar stock
            </button>
          </div>
          <span class="stock-status ${(p.enteroStock || 0) > 0 ? 'in-stock' : 'out-stock'}">
            ${(p.enteroStock || 0) > 0 ? `🛍 ${p.enteroStock} disponible${p.enteroStock === 1 ? '' : 's'} como entero` : 'Solo decants'}
          </span>
        </div>
        ${(p.enteroStock || 0) > 0 ? `
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
        </div>` : ''}` : ''}

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

  container.querySelectorAll('.btn-save-entero-stock').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = parseInt(btn.dataset.id);
      const card = btn.closest('.admin-card');
      const inp  = card.querySelector('.entero-stock-input');
      const qty  = parseInt(inp?.value ?? '0');
      if (isNaN(qty) || qty < 0) { showToast('El stock debe ser un número positivo.'); return; }
      const err = await CloudProducts.update(id, { enteroStock: qty, availableAsEntero: qty > 0 });
      if (err) {
        showToast(`❌ Error Supabase: ${err.message || JSON.stringify(err)}`);
      } else {
        showToast(qty > 0 ? `✓ ${qty} frasco${qty === 1 ? '' : 's'} entero disponible${qty === 1 ? '' : 's'}` : '✓ Sin frascos enteros — solo decants');
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

      // Si lo que queda ya no alcanza ni para el tamaño más chico, marcar agotado
      // automáticamente (y reactivar si se rellena el frasco por encima de ese mínimo)
      const product = products.find(pp => pp.id === id) || Products.getById(id);
      if (total > 0 && product) {
        const minSize = minDecantSizeMl(product.sizes);
        updates.inStock = !minSize || remaining >= minSize;
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

function updateDupeImgPreview(url) {
  const wrap    = document.getElementById('dupeImgPreviewWrap');
  const preview = document.getElementById('dupeImgPreview');
  if (url) {
    preview.src = url;
    preview.onerror = () => { wrap.style.display = 'none'; };
    preview.onload  = () => { wrap.style.display = 'flex'; };
  } else {
    wrap.style.display = 'none';
    preview.src = '';
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
  document.getElementById('editAccords').value     = accordsToText(product?.accords);
  document.getElementById('editDupeName').value      = product?.dupeOf?.name  ?? '';
  document.getElementById('editDupeBrand').value     = product?.dupeOf?.brand ?? '';
  document.getElementById('editDupeImageUrl').value  = product?.dupeOf?.imageUrl ?? '';
  updateDupeImgPreview(product?.dupeOf?.imageUrl ?? '');
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

    const accords = parseAccordsText(document.getElementById('editAccords').value);

    const dupeName = document.getElementById('editDupeName').value.trim();
    const dupeBrand = document.getElementById('editDupeBrand').value.trim();
    const dupeImageUrl = document.getElementById('editDupeImageUrl').value.trim();
    const dupeOf = dupeName ? { name: dupeName, brand: dupeBrand, imageUrl: dupeImageUrl } : null;

    // No pisar stock/destacado al editar: solo se fijan valores por defecto
    // al crear un perfume nuevo. Antes esto siempre reseteaba inStock a true
    // y bottleRemainingMl/bottleTotalMl a 0 en cada edición, borrando el
    // seguimiento de stock de un producto ya agotado.
    const data = { name, brand, type, gender, occasion, olfFamily, topNotes, heartNotes, baseNotes, accords, dupeOf, description, contentDescription, imageUrl, sizes };
    if (!id) Object.assign(data, { inStock: true, bottleRemainingMl: 0, bottleTotalMl: 0, featured: false });

    const saveBtn = document.getElementById('saveProductBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
    try {
      if (id) {
        // update() devuelve el error de Supabase (no lo lanza): antes se ignoraba y
        // el panel mostraba "actualizado ✓" aunque no se hubiera guardado en la nube.
        const updateError = await CloudProducts.update(parseInt(id), data);
        if (updateError) throw new Error(`No se pudo guardar en Supabase (${updateError.code || 'error'}): ${updateError.message}`);
      } else {
        await CloudProducts.add(data);
      }
      document.getElementById('productModal').classList.remove('open');
      renderAdminProducts().catch(console.error);
      showToast(id ? 'Perfume actualizado ✓' : 'Perfume agregado ✓');
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Error al guardar. Inténtalo de nuevo.');
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

  // ── "Se parece a" (dupe) — vista previa en vivo de la ruta pegada ───────────
  document.getElementById('editDupeImageUrl')?.addEventListener('input', e => {
    updateDupeImgPreview(e.target.value.trim());
  });

  // Cambiar contraseña (usa Supabase Auth)
  document.getElementById('changePassForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw1  = document.getElementById('adminNewPassword').value;
    const pw2  = document.getElementById('adminConfirmPassword').value;
    const msg  = document.getElementById('passChangeMsg');
    if (pw1.length < 8) { msg.textContent = 'Mínimo 8 caracteres.'; msg.className = 'msg-error'; msg.style.display = 'block'; return; }
    if (pw1 !== pw2)    { msg.textContent = 'Las contraseñas no coinciden.'; msg.className = 'msg-error'; msg.style.display = 'block'; return; }

    const btn = e.target.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Cambiando…'; }

    try {
      const { error } = await withTimeout(db.auth.updateUser({ password: pw1 }), 12000, 'el cambio de contraseña');
      if (error) {
        msg.textContent = 'Error al cambiar contraseña: ' + error.message;
        msg.className = 'msg-error';
      } else {
        msg.textContent = '¡Contraseña cambiada correctamente!';
        msg.className = 'msg-success';
        e.target.reset();
      }
    } catch (err) {
      msg.textContent = 'Error al cambiar contraseña: ' + (err.message || 'inténtalo de nuevo.');
      msg.className = 'msg-error';
    }
    msg.style.display = 'block';
    if (btn) { btn.disabled = false; btn.textContent = 'Cambiar Contraseña'; }
  });

  setupCampaignEvents();
  setupAnnouncementEvents();
  setupGalleryEvents();
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
