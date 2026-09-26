// ─── Ficha de un combo (como la de un perfume) ────────────────────────────────
//
// Se abre al tocar la foto, el nombre o "Ver detalles" de una tarjeta de combo.
// Usa el mismo historial que la ficha del perfume (product-detail.js): "atrás"
// vuelve al catálogo, y la dirección es /?combo=ID (se puede recargar/compartir).
// Reutiliza los estilos pd-* y la franja de confianza de la ficha del perfume.

let _cdCombo  = null;
let _cdSize   = null;
let _cdPrice  = 0;
let _cdQty    = 1;

function _createCdModal() {
  if (document.getElementById('cdModal')) return;
  const el = document.createElement('div');
  el.id = 'cdModal';
  el.className = 'pd-modal cd-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="pd-panel">
      <div class="pd-topbar">
        <button class="pd-close" aria-label="Volver al catálogo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span>CATÁLOGO</span>
        </button>
      </div>

      <div class="pd-layout">
        <div class="pd-left-col">
          <div class="pd-hero-img-wrap">
            <img id="cdImg" class="pd-hero-img cd-hero-img" alt="">
            <div id="cdCollage" class="cd-collage"></div>
          </div>
        </div>

        <div class="pd-right-col">
          <nav class="pd-breadcrumb">
            <span class="cd-bc-close">CATÁLOGO</span>
            <span class="pd-bc-sep">›</span>
            <span>COMBOS</span>
          </nav>
          <h2 id="cdName" class="pd-product-name"></h2>
          <p id="cdSubtitle" class="pd-product-subtitle"></p>
          <p id="cdDesc" class="pd-desc-text"></p>
          <div id="cdPriceRow" class="pd-price-row"></div>

          <div id="cdSizeSection" class="pd-size-section">
            <p class="pd-notes-section-title">ELIGE EL TAMAÑO DE CADA PERFUME</p>
            <div id="cdSizesRow" class="pd-size-cards"></div>
          </div>

          <div class="cd-includes">
            <p class="pd-notes-section-title">INCLUYE</p>
            <div id="cdItems" class="pd-combine-list"></div>
          </div>

          <div id="cdFaq" class="pd-faq"></div>

          <p id="cdUnavailable" class="cd-unavailable" hidden>Este combo no está disponible por ahora. Escríbenos por WhatsApp y te avisamos cuando vuelva.</p>

          <div id="cdQtyRow" class="pd-qty-row">
            <div class="pd-qty" role="group" aria-label="Cantidad">
              <button type="button" class="pd-qty-btn cd-qty-btn" data-qty="-1" aria-label="Quitar uno">−</button>
              <span id="cdQtyVal" class="pd-qty-val" aria-live="polite">1</span>
              <button type="button" class="pd-qty-btn cd-qty-btn" data-qty="1" aria-label="Agregar uno">+</button>
            </div>
            <p class="pd-total">Total <strong id="cdTotal">S/ 0</strong></p>
          </div>

          <div class="pd-actions" id="cdActions">
            <button id="cdCartBtn" class="pd-cart-btn" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8"/>
              </svg>
              <span id="cdCartBtnText">Añadir combo</span>
            </button>
            <button id="cdBuyBtn" class="pd-buy-btn" type="button">Comprar ahora</button>
          </div>

          ${PD_TRUST_HTML}
        </div>
      </div>
    </div>`;
  const footer = document.querySelector('.footer');
  if (footer) footer.parentNode.insertBefore(el, footer);
  else document.body.appendChild(el);

  el.querySelector('.pd-close').addEventListener('click', () => closePdModal());
  el.querySelector('.cd-bc-close').addEventListener('click', () => closePdModal());
  if (typeof faqForProductHtml === 'function') document.getElementById('cdFaq').innerHTML = faqForProductHtml();

  el.querySelectorAll('.cd-qty-btn').forEach(b => b.addEventListener('click', () => {
    _cdQty = Math.max(1, Math.min(10, _cdQty + parseInt(b.dataset.qty)));
    _cdUpdateTotals();
  }));

  document.getElementById('cdCartBtn').addEventListener('click', () => {
    const btn = document.getElementById('cdCartBtn');
    if (!_cdCombo || btn.classList.contains('pd-cart-wa')) return;
    _cdAddToCart();
    btn.classList.add('added');
    document.getElementById('cdCartBtnText').textContent = '¡Agregado! ✓';
    setTimeout(() => { btn.classList.remove('added'); _cdUpdateTotals(); }, 1800);
  });

  document.getElementById('cdBuyBtn').addEventListener('click', () => {
    if (!_cdCombo) return;
    _cdAddToCart();
    const stockErrors = validateCartStock();
    if (stockErrors.length) { showStockAlert(stockErrors); return; }
    Cart.hideCart();
    Checkout.open();
  });
}

function _cdUpdateTotals() {
  document.getElementById('cdQtyVal').textContent = _cdQty;
  const total = (_cdPrice || 0) * _cdQty;
  document.getElementById('cdTotal').textContent = `S/ ${_pdMoney(total)}`;
  const btn = document.getElementById('cdCartBtn');
  if (btn.classList.contains('pd-cart-wa') || btn.classList.contains('added')) return;
  document.getElementById('cdCartBtnText').textContent = `Añadir · S/ ${_pdMoney(total)}`;
}

function _cdAddToCart() {
  const products = _allProducts || Products.getAll();
  for (let i = 0; i < _cdQty; i++) Cart.addCombo(_cdCombo, products, _cdSize);
  const n = _cdQty;
  _cdQty = 1;
  _cdUpdateTotals();
  showCartToast(n > 1 ? `🛍 Agregamos ${n} combos a tu carrito` : `Combo "${_cdCombo.title}" (${_cdSize}) agregado`);
}

function openComboModal(comboId, { fromHistory = false } = {}) {
  const combo = (typeof _allCombos !== 'undefined' && _allCombos || []).find(c => c.id === comboId);
  if (!combo) return;
  _createCdModal();

  const wasOpen = _anyDetailOpen();
  if (!wasOpen) _pdReturnY = window.scrollY;
  if (!fromHistory) {
    _pdDepth = wasOpen ? _pdDepth + 1 : 1;
    try { history.scrollRestoration = 'manual'; history.pushState({ combo: combo.id, depth: _pdDepth }, '', `/?combo=${combo.id}`); } catch (_) {}
  }
  document.getElementById('pdModal')?.classList.remove('open');   // venía de un perfume

  const products = _allProducts || Products.getAll();
  const byId     = new Map(products.map(p => [p.id, p]));
  const items    = (combo.items || []).map(id => byId.get(id)).filter(Boolean);
  const tiers    = comboAvailableSizes(combo, products);
  _cdCombo = combo; _cdQty = 1;

  // ── Imagen: la del combo, o un collage con las fotos de sus perfumes ──
  const img = document.getElementById('cdImg');
  const collage = document.getElementById('cdCollage');
  if (combo.imageUrl) {
    img.src = combo.imageUrl; img.alt = combo.title; img.hidden = false;
    collage.innerHTML = '';
  } else {
    img.hidden = true; img.removeAttribute('src');
    collage.innerHTML = items.filter(p => p.imageUrl).slice(0, 4)
      .map(p => `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(p.name)}" loading="lazy">`).join('');
  }

  document.getElementById('cdName').textContent = combo.title;
  document.getElementById('cdSubtitle').innerHTML = [`Combo`, `${items.length} perfumes`]
    .map(s => `<span>${s}</span>`).join('<span style="opacity:.3;margin:0 .1rem">·</span>');
  document.getElementById('cdDesc').textContent = combo.description || '';

  // ── Tallas: precio del combo, lo que costaría por separado y el ahorro ──
  const sizesRow = document.getElementById('cdSizesRow');
  const priceRow = document.getElementById('cdPriceRow');
  const cartBtn  = document.getElementById('cdCartBtn');
  cartBtn.classList.remove('added', 'pd-cart-wa');
  const available = tiers.length > 0;
  document.getElementById('cdUnavailable').hidden = available;
  document.getElementById('cdQtyRow').hidden      = !available;
  document.getElementById('cdActions').hidden     = !available;
  document.getElementById('cdSizeSection').hidden = !available;

  const selectTier = size => {
    const t = tiers.find(x => x.size === size);
    if (!t) return;
    _cdSize = t.size; _cdPrice = t.price;
    sizesRow.querySelectorAll('.pd-size-card').forEach(c => c.classList.toggle('active', c.dataset.size === size));
    const before = t.before > t.price ? t.before : 0;
    priceRow.innerHTML = `${before ? `<s class="pd-price-before">S/ ${_pdMoney(before)}</s> ` : ''}<strong class="pd-price-main">S/ ${_pdMoney(t.price)}</strong>`
      + (before ? ` <span class="pd-price-off">-${Math.round((1 - t.price / before) * 100)}%</span>` : '');
    document.querySelectorAll('#cdItems .cd-item-size').forEach(s => { s.textContent = t.size; });
    _cdUpdateTotals();
  };

  sizesRow.innerHTML = tiers.map(t => {
    const saving = t.before - t.price;
    return _pdSizeCardHtml({
      size: t.size, price: t.price, before: t.before > t.price ? _pdMoney(t.before) : 0,
      note: saving > 0 ? `Ahorras S/ ${_pdMoney(saving)}` : `${items.length} × ${t.size}`
    });
  }).join('');
  sizesRow.querySelectorAll('.pd-size-card:not([disabled])').forEach(card => {
    card.addEventListener('click', () => selectTier(card.dataset.size));
  });

  // ── Qué incluye: cada perfume lleva a su ficha ──
  document.getElementById('cdItems').innerHTML = items.map(p => {
    const t = productTypeInfo(p.type);
    return `
      <button type="button" class="pd-combine-item cd-item" data-id="${p.id}">
        <span class="pd-combine-thumb">${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}</span>
        <span class="pd-combine-info">
          <span class="pd-combine-name">${sanitize(p.name)}</span>
          <span class="pd-combine-meta"><span class="pd-combine-type ${t.badge}">${t.label}</span>${sanitize(p.brand)} · <span class="cd-item-size"></span></span>
        </span>
        <span class="cd-item-go" aria-hidden="true">Ver ›</span>
      </button>`;
  }).join('');
  document.querySelectorAll('#cdItems .cd-item').forEach(b => b.addEventListener('click', () => openPdModal(parseInt(b.dataset.id))));

  if (available) {
    const pick = tiers.find(t => t.size === BEST_SELLER_SIZE) || tiers[0];
    selectTier(pick.size);
  } else {
    priceRow.innerHTML = '';
    _cdSize = null; _cdPrice = 0;
  }

  // Ocultar el catálogo y mostrar la ficha
  document.querySelectorAll(_PD_HIDE_SELECTOR).forEach(el => el.classList.add('pd-page-hidden'));
  document.body.classList.add('pd-open');
  document.getElementById('cdModal').classList.add('open');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Abrir un combo al cargar la página con /?combo=ID (los combos cargan después
// del catálogo, así que se espera a que estén listos)
(function handleComboLink() {
  const params = new URLSearchParams(location.search);
  if (!params.has('combo')) return;
  const cid = parseInt(params.get('combo'));
  const tryOpen = setInterval(() => {
    if (typeof _allCombos === 'undefined' || !Array.isArray(_allCombos) || !_allProducts) return;
    clearInterval(tryOpen);
    params.delete('combo');
    const qs = params.toString();
    history.replaceState(null, '', '/' + (qs ? '?' + qs : ''));
    if (Number.isInteger(cid)) openComboModal(cid);
  }, 200);
  setTimeout(() => clearInterval(tryOpen), 12000);
})();
