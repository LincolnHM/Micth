// ─── Sección: Combos de Decants ──────────────────────────────────────────────
// Un combo es un set fijo de 2-3 perfumes (uno de cada uno). NO tiene un
// único precio: el admin pone hasta 4, uno por talla (2/3/5/10ml) — el
// cliente elige con qué talla quiere TODOS los perfumes del combo y paga el
// precio de esa talla. El "precio antes" de cada talla se recalcula siempre
// en vivo contra el catálogo — nunca se guarda congelado.

let _comboProductsCache = null;

function _comboMarginColor(pct) {
  if (pct >= 15) return '#4caf50';
  if (pct > 0)   return '#ff9800';
  return '#ef5350';
}

async function renderAdminCombos() {
  const container = document.getElementById('adminComboList');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;color:var(--text2);padding:2.5rem;font-size:.85rem">Cargando combos…</div>`;

  let combos = [], products = [];
  try {
    [combos, products] = await Promise.all([
      withTimeout(CloudCombos.getAll(), 15000, 'los combos'),
      withTimeout(CloudProducts.getAll(), 15000, 'los perfumes')
    ]);
  } catch (err) {
    container.innerHTML = `<div style="text-align:center;color:#ef5350;padding:2rem">No se pudieron cargar los combos. Recarga la página.</div>`;
    return;
  }

  if (!combos.length) {
    container.innerHTML = `
      <div style="text-align:center;color:var(--text2);padding:3rem 1.5rem">
        <p style="margin-bottom:.5rem;font-size:.95rem">Todavía no armaste ningún combo.</p>
        <p style="font-size:.8rem;color:var(--text3)">Presiona "+ Nuevo Combo" para elegir 2 o 3 perfumes y poner el precio por talla (2ml, 3ml, 5ml, 10ml).</p>
      </div>`;
    return;
  }

  const prodLookup = {};
  products.forEach(p => { prodLookup[p.id] = p; });

  container.innerHTML = combos.map(combo => {
    const items = combo.items || [];

    // Si el admin subió una foto propia del combo, esa manda; si no, se arma
    // un collage automático con las fotos de los perfumes incluidos.
    const thumbs = combo.imageUrl
      ? `<img src="${escapeAttr(combo.imageUrl)}" alt="" class="combo-thumb combo-thumb-custom" loading="lazy" onerror="this.style.display='none'">`
      : items.slice(0, 4).map(pid => {
          const p = prodLookup[pid];
          if (!p) return '';
          const img = _normAdminImg(p.imageUrl) || buildProductImage(p);
          return `<img src="${escapeAttr(img)}" alt="" class="combo-thumb" loading="lazy" onerror="this.style.display='none'">`;
        }).join('');
    const extra = !combo.imageUrl && items.length > 4 ? `<span class="combo-thumb-extra">+${items.length - 4}</span>` : '';

    const itemsListHtml = items.map(pid => {
      const p = prodLookup[pid];
      const label = p ? `${sanitize(p.brand)} ${sanitize(p.name)}` : `⚠ Perfume #${pid} (ya no existe)`;
      return `<span class="combo-item-chip">${label}</span>`;
    }).join('');

    // Una fila de antes/después por cada talla que el admin haya puesto precio.
    const tiersHtml = COMBO_SIZES.map(size => {
      const price = parseFloat(combo.prices?.[size]) || 0;
      if (!price) return '';
      const { before, available } = comboSizeInfo(combo, products, size);
      const savings = before - price;
      const pct = before > 0 ? (savings / before * 100) : 0;
      const sColor = _comboMarginColor(pct);
      return `
        <div class="combo-tier-row">
          <span class="combo-tier-size">${sanitize(size)}</span>
          ${available
            ? `<span class="combo-tier-before">S/${before.toFixed(2)}</span>
               <span class="combo-tier-final">S/${price.toFixed(2)}</span>
               <span class="combo-tier-savings" style="color:${sColor}">${savings >= 0 ? 'Ahorra' : 'Pierde'} ${Math.abs(pct).toFixed(0)}%</span>`
            : `<span class="combo-tier-warn">⚠ No disponible para todos los perfumes elegidos</span>`}
        </div>`;
    }).join('');

    return `
    <div class="admin-card combo-admin-card" data-id="${combo.id}">
      <div class="combo-admin-card-top">
        <div class="combo-thumbs">${thumbs}${extra}</div>
        <div class="combo-admin-card-info">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <h3 style="margin:0">${sanitize(combo.title)}</h3>
            <span class="combo-status-badge ${combo.active ? 'active' : 'inactive'}">${combo.active ? 'Activo' : 'Inactivo'}</span>
          </div>
          ${combo.description ? `<p class="combo-admin-desc">${sanitize(combo.description)}</p>` : ''}
          <div class="combo-items-chips">${itemsListHtml || '<span style="color:var(--text3);font-size:.78rem">Sin perfumes agregados</span>'}</div>
        </div>
        <div class="combo-admin-prices">
          ${tiersHtml || '<span style="color:var(--text3);font-size:.78rem">Sin precios puestos</span>'}
        </div>
      </div>
      <div class="combo-admin-actions">
        <button class="btn-edit-combo" data-id="${combo.id}">Editar</button>
        <button class="btn-toggle-combo" data-id="${combo.id}" data-active="${combo.active}">${combo.active ? 'Desactivar' : 'Activar'}</button>
        <button class="btn-delete-combo" data-id="${combo.id}">Eliminar</button>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.btn-edit-combo').forEach(btn => {
    btn.addEventListener('click', () => openComboModal(parseInt(btn.dataset.id)));
  });
  container.querySelectorAll('.btn-toggle-combo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const isActive = btn.dataset.active === 'true';
      btn.disabled = true;
      try {
        await CloudCombos.update(id, { active: !isActive });
        showToast(isActive ? 'Combo desactivado' : 'Combo activado ✓');
        await renderAdminCombos();
      } catch (err) {
        console.error('[MICHT] Error al cambiar estado del combo:', err);
        showToast(err?.message || 'Error al actualizar el combo.');
        btn.disabled = false;
      }
    });
  });
  container.querySelectorAll('.btn-delete-combo').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const combo = combos.find(c => c.id === id);
      showConfirmModal(`¿Eliminar el combo "${combo?.title || ''}"? Esta acción no se puede deshacer.`, async () => {
        try {
          await CloudCombos.delete(id);
          showToast('Combo eliminado ✓');
          await renderAdminCombos();
        } catch (err) {
          console.error('[MICHT] Error al eliminar combo:', err);
          showToast(err?.message || 'Error al eliminar el combo.');
        }
      });
    });
  });
}

function updateComboImgPreview(url) {
  const preview     = document.getElementById('comboImgPreview');
  const placeholder = document.getElementById('comboImgPlaceholder');
  const zone        = document.getElementById('comboImgUploadZone');
  const actions     = document.getElementById('comboImgUploadActions');
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

// La foto viaja dentro de la fila del combo y cada visitante de la tienda la
// descarga, así que se reduce antes de guardarla (compressImageFile, de
// cloud-gallery.js): a 1000px de ancho y JPEG 82% se ve nítida en la tarjeta
// y pesa ~100–250 KB en vez de varios MB.
async function handleComboImageFile(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Selecciona una imagen válida (JPG, PNG o WebP).'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('La imagen supera los 10 MB.'); return; }
  try {
    const blob = await compressImageFile(file, 1000, 0.82);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
    document.getElementById('comboImageUrl').value = dataUrl;
    updateComboImgPreview(dataUrl);
  } catch (err) {
    console.error('[MICHT] Error procesando imagen del combo:', err);
    showToast(err.message || 'No se pudo procesar la imagen.');
  }
}

// Estado del combo que se está editando en el modal — un array de productId
// (uno de cada perfume) y los precios por talla que se van escribiendo.
// Se resetean cada vez que se abre el modal (openComboModal).
let _comboSelectedItems = [];
let _comboTierPrices = {};

async function openComboModal(id = null) {
  const modal = document.getElementById('comboModal');
  let combo = null;
  if (id) {
    try { combo = await withTimeout(CloudCombos.getById(id), 12000, 'el combo'); }
    catch { combo = Combos.getById(id); }
  }

  _comboShowError('');
  document.getElementById('modalComboTitle').textContent = combo ? 'Editar Combo' : 'Nuevo Combo';
  document.getElementById('comboEditId').value       = combo?.id ?? '';
  document.getElementById('comboTitle').value        = combo?.title ?? '';
  document.getElementById('comboDescription').value  = combo?.description ?? '';
  document.getElementById('comboActive').checked     = combo ? !!combo.active : true;
  document.getElementById('comboItemSearch').value   = '';
  const comboImageUrl = combo?.imageUrl ?? '';
  document.getElementById('comboImageUrl').value = comboImageUrl;
  updateComboImgPreview(comboImageUrl);
  document.getElementById('comboImgFileInput').value = '';

  const saveBtn = document.getElementById('saveComboBtn');
  const originalLabel = 'Guardar Combo';
  saveBtn.disabled = true;
  saveBtn.textContent = 'Cargando catálogo…';
  try {
    _comboProductsCache = await withTimeout(CloudProducts.getAll(), 15000, 'el catálogo');
  } catch {
    _comboProductsCache = Products.getAll();
  }
  saveBtn.disabled = false;
  saveBtn.textContent = originalLabel;

  _comboSelectedItems = combo?.items ? [...combo.items] : [];
  _comboTierPrices    = { ...(combo?.prices || {}) };

  setupComboItemSearchBox();
  renderComboItemChips(); // también dispara renderComboSizeTiers()

  modal.classList.add('open');
}

// ── Buscador de perfumes para agregar al combo (uno a la vez, sin talla ni
// cantidad — la talla se define después, a nivel de combo, no por perfume) ──
function setupComboItemSearchBox() {
  const searchInput = document.getElementById('comboItemSearch');
  const dropdown     = document.getElementById('comboItemDropdown');
  if (!searchInput || searchInput._comboBound) return;
  searchInput._comboBound = true;

  function buildMatches(filterText) {
    const products = (_comboProductsCache || []).filter(p =>
      p.type !== 'entero' &&
      !_comboSelectedItems.includes(p.id) &&
      Object.values(p.sizes || {}).some(price => price > 0)
    );
    const q = _normalizeSearchText(filterText);
    if (!q) return products.slice(0, 25);
    const qWords = q.split(/\s+/).filter(Boolean);
    return products
      .map(p => ({ p, score: _fuzzyMatchScore(qWords, _normalizeSearchText(`${p.brand} ${p.name}`).split(/\s+/).filter(Boolean)) }))
      .filter(x => x.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 25)
      .map(x => x.p);
  }

  function renderDropdown() {
    const matches = buildMatches(searchInput.value);
    if (!matches.length) { dropdown.style.display = 'none'; return; }
    dropdown.innerHTML = matches.map(p =>
      `<div class="prod-opt" data-pid="${p.id}"
            style="padding:.42rem .75rem;cursor:pointer;font-size:.82rem;color:var(--text2);border-bottom:1px solid var(--border);transition:background .12s"
            onmouseenter="this.style.background='var(--gold-dim)';this.style.color='var(--text)'"
            onmouseleave="this.style.background='';this.style.color='var(--text2)'">${sanitize(p.brand)} – ${sanitize(p.name)}</div>`
    ).join('');
    dropdown.style.display = 'block';
    requestAnimationFrame(() => dropdown.scrollIntoView({ block: 'nearest' }));
    dropdown.querySelectorAll('.prod-opt').forEach(opt => {
      const pick = e => {
        e.preventDefault();
        const product = (_comboProductsCache || []).find(p => p.id === parseInt(opt.dataset.pid));
        if (product) { _comboSelectedItems.push(product.id); renderComboItemChips(); }
        searchInput.value = '';
        dropdown.style.display = 'none';
        if (!('ontouchstart' in window)) searchInput.focus();
      };
      _bindTapSelect(opt, pick);
    });
  }

  searchInput.addEventListener('input', renderDropdown);
  searchInput.addEventListener('focus', renderDropdown);
  searchInput.addEventListener('blur',  () => setTimeout(() => { dropdown.style.display = 'none'; }, 250));
}

function removeComboItem(productId) {
  _comboSelectedItems = _comboSelectedItems.filter(id => id !== productId);
  renderComboItemChips();
}

function renderComboItemChips() {
  const wrap = document.getElementById('comboItemsChips');
  const products = _comboProductsCache || [];
  if (!_comboSelectedItems.length) {
    wrap.innerHTML = '<span style="color:var(--text3);font-size:.78rem">Todavía no agregaste ningún perfume.</span>';
  } else {
    wrap.innerHTML = _comboSelectedItems.map(pid => {
      const p = products.find(pr => pr.id === pid);
      const label = p ? `${sanitize(p.brand)} ${sanitize(p.name)}` : `⚠ Perfume #${pid} ya no existe`;
      return `<span class="combo-item-chip combo-item-chip-removable">${label}<button type="button" class="combo-item-chip-remove" data-pid="${pid}" aria-label="Quitar">×</button></span>`;
    }).join('');
    wrap.querySelectorAll('.combo-item-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => removeComboItem(parseInt(btn.dataset.pid)));
    });
  }
  renderComboSizeTiers();
}

// ── Precio por talla ─────────────────────────────────────────────────────────
// Un combo no tiene un único precio: tiene hasta 4 (uno por talla). Cada fila
// muestra "antes" (suma real de los perfumes elegidos en esa talla) en vivo,
// y el admin escribe el precio del combo para esa talla — el ahorro se
// calcula solo. Si algún perfume elegido no tiene esa talla con precio, se
// marca "no disponible" y no se puede poner precio ahí.

function _comboTierInfo(size) {
  return comboSizeInfo({ items: _comboSelectedItems }, _comboProductsCache || [], size);
}

function renderComboSizeTiers() {
  const wrap = document.getElementById('comboSizeTiers');
  const hasItems = _comboSelectedItems.length > 0;

  wrap.innerHTML = COMBO_SIZES.map(size => {
    const { before, available } = _comboTierInfo(size);
    const usable = hasItems && available;
    return `
      <div class="combo-tier-edit-row">
        <span class="combo-tier-edit-size">${size}</span>
        <span class="combo-tier-edit-before">${usable ? `Antes S/${before.toFixed(2)}` : (hasItems ? 'No disponible' : '—')}</span>
        <div class="combo-tier-edit-price-wrap">
          <span class="combo-tier-edit-currency">S/</span>
          <input type="number" class="combo-tier-price-input" data-size="${size}" min="0" step="0.5" placeholder="0.00"
                 value="${escapeAttr(_comboTierPrices[size] || '')}" ${usable ? '' : 'disabled'}>
        </div>
        <span class="combo-tier-edit-savings" id="comboTierSavings-${size}"></span>
      </div>`;
  }).join('');

  wrap.querySelectorAll('.combo-tier-price-input').forEach(inp => {
    inp.addEventListener('input', () => {
      _comboTierPrices[inp.dataset.size] = inp.value;
      _updateComboTierSavings(inp.dataset.size);
    });
  });

  COMBO_SIZES.forEach(size => _updateComboTierSavings(size));
}

function _updateComboTierSavings(size) {
  const el = document.getElementById('comboTierSavings-' + size);
  if (!el) return;
  const { before, available } = _comboTierInfo(size);
  const price = parseFloat(_comboTierPrices[size]) || 0;
  if (!_comboSelectedItems.length || !available || !price) { el.textContent = ''; return; }
  const savings = before - price;
  const pct = before > 0 ? (savings / before * 100) : 0;
  el.textContent = `${savings >= 0 ? 'Ahorra' : 'Pierde'} S/${Math.abs(savings).toFixed(2)} (${pct.toFixed(0)}%)`;
  el.style.color = _comboMarginColor(pct);
}

// Muestra un error dentro del modal (se queda visible hasta el próximo intento,
// a diferencia del aviso flotante que desaparece en 3 segundos).
function _comboShowError(msg) {
  const el = document.getElementById('comboSaveError');
  if (el) el.textContent = msg || '';
  if (msg) showToast(msg);
}

async function saveCombo() {
  _comboShowError('');
  const id          = document.getElementById('comboEditId').value;
  const title       = document.getElementById('comboTitle').value.trim();
  const description = document.getElementById('comboDescription').value.trim();
  const imageUrl    = document.getElementById('comboImageUrl').value.trim();
  const active      = document.getElementById('comboActive').checked;

  if (!title) { _comboShowError('Ponle un nombre al combo.'); return; }
  if (_comboSelectedItems.length < 2) { _comboShowError('Agrega al menos 2 perfumes al combo.'); return; }

  const prices = {};
  COMBO_SIZES.forEach(size => {
    const val = parseFloat(_comboTierPrices[size]);
    if (val > 0) prices[size] = val;
  });
  if (!Object.keys(prices).length) { _comboShowError('Pon el precio del combo en al menos una talla.'); return; }

  const saveBtn = document.getElementById('saveComboBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    const comboData = { title, description, items: [..._comboSelectedItems], prices, imageUrl, active };
    if (id) {
      await withTimeout(CloudCombos.update(parseInt(id), comboData), 15000, 'el combo');
      showToast('Combo actualizado ✓');
    } else {
      await withTimeout(CloudCombos.add(comboData), 15000, 'el combo');
      showToast('Combo creado ✓');
    }
    document.getElementById('comboModal').classList.remove('open');
    renderAdminCombos().catch(console.error);
  } catch (err) {
    console.error('[MICHT] Error guardando combo:', err);
    _comboShowError(err?.message || 'Error al guardar el combo. Inténtalo de nuevo.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar Combo';
  }
}

function setupComboEvents() {
  document.getElementById('addComboBtn')?.addEventListener('click', () => openComboModal());
  document.getElementById('closeComboModal')?.addEventListener('click', () => {
    document.getElementById('comboModal').classList.remove('open');
  });
  document.getElementById('cancelComboModal')?.addEventListener('click', () => {
    document.getElementById('comboModal').classList.remove('open');
  });
  document.getElementById('saveComboBtn')?.addEventListener('click', saveCombo);

  // ── Subida de imagen del combo ──────────────────────────────────────────────
  const comboImgZone   = document.getElementById('comboImgUploadZone');
  const comboImgInput  = document.getElementById('comboImgFileInput');
  const comboImgChange = document.getElementById('comboImgChangeBtn');
  const comboImgRemove = document.getElementById('comboImgRemoveBtn');

  comboImgZone?.addEventListener('click', () => comboImgInput?.click());
  comboImgZone?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') comboImgInput?.click(); });
  comboImgInput?.addEventListener('change', () => { if (comboImgInput.files[0]) handleComboImageFile(comboImgInput.files[0]); });

  comboImgZone?.addEventListener('dragover', e => { e.preventDefault(); comboImgZone.classList.add('drag-over'); });
  comboImgZone?.addEventListener('dragleave', () => comboImgZone.classList.remove('drag-over'));
  comboImgZone?.addEventListener('drop', e => {
    e.preventDefault();
    comboImgZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleComboImageFile(e.dataTransfer.files[0]);
  });

  comboImgChange?.addEventListener('click', e => { e.stopPropagation(); comboImgInput.click(); });
  comboImgRemove?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('comboImageUrl').value = '';
    updateComboImgPreview('');
    comboImgInput.value = '';
  });
}
