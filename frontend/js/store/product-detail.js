// ─── Modal de detalle de producto (v2) ────────────────────────────────────────

let _pdProduct  = null;
let _pdSelSize  = null;
let _pdSelPrice = 0;
let _pdQty      = 1;

// Talla que se muestra con la etiqueta "MÁS VENDIDO" y que viene elegida al abrir
const BEST_SELLER_SIZE = '5ml';

// Franja de confianza (ficha de perfume y ficha de combo)
const PD_TRUST_HTML = `
          <div class="pd-trust">
            <div class="pd-trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span>Perfumes<br>100% originales</span>
            </div>
            <div class="pd-trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              <span>Envíos a<br>todo el Perú</span>
            </div>
            <div class="pd-trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
              <span>Delivery gratis<br>en Soritor</span>
            </div>
          </div>`;

// ¿Hay una ficha abierta? (de perfume #pdModal o de combo #cdModal)
function _anyDetailOpen() { return !!document.querySelector('.pd-modal.open'); }

// ─── El detalle es una "página" más del historial ────────────────────────────
// Cada perfume abierto agrega una entrada (?p=ID). Así el botón "atrás" del
// celular vuelve al catálogo en vez de sacar al cliente de la tienda, y el
// catálogo reaparece en el mismo lugar donde lo dejó.
let _pdReturnY = 0;   // posición del catálogo al abrir el primer perfume
let _pdDepth   = 0;   // perfumes apilados en el historial desde el catálogo

try { history.scrollRestoration = 'manual'; } catch (_) {}

function _pdUrl(id) {
  const slug = typeof productSlug === 'function' ? productSlug(id) : '';
  if (slug) return `/perfume/${slug}/`;
  const params = new URLSearchParams(location.search);
  params.set('p', id);
  return location.pathname + '?' + params.toString();
}

// Todo lo que va entre el header y el footer es "catálogo" y se oculta mientras
// se ve un perfume (antes era una lista fija y la sección Combos quedaba visible
// encima del detalle).
const _PD_HIDE_SELECTOR = 'body > section, body > main, body > .marquee-strip, body > .parallax-divider, body > #catalogBanner';

window.addEventListener('popstate', e => {
  const st = e.state;
  if (st && Number.isInteger(st.pd)) {   // ojo: L'Immensité tiene id 0
    _pdDepth = st.depth || 1;
    openPdModal(st.pd, { fromHistory: true });
  } else if (st && Number.isInteger(st.combo) && typeof openComboModal === 'function') {
    _pdDepth = st.depth || 1;
    openComboModal(st.combo, { fromHistory: true });
  } else {
    _pdHide(true);
  }
});

// Perfume agotado: el botón del carrito pasa a pedir aviso por WhatsApp
function _pdSetNotify(cartBtn, cartTxt, p) {
  _pdSetBuyable(false);
  cartBtn.disabled = false;
  cartBtn.classList.remove('pd-cart-pick');
  cartBtn.classList.add('pd-cart-wa');
  cartTxt.textContent = '🔔 Avísame cuando vuelva';
  cartBtn.onclick = e => {
    e.preventDefault();
    window.open(notifyWaUrl(p), '_blank');
  };
}

function _pdEscHandler(e) {
  if (e.key === 'Escape' && _anyDetailOpen()) closePdModal();
}

function _createPdModal() {
  if (document.getElementById('pdModal')) return;
  const el = document.createElement('div');
  el.id = 'pdModal';
  el.className = 'pd-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="pd-backdrop"></div>
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
        <!-- Columna imagen -->
        <div class="pd-left-col">
          <div class="pd-hero-img-wrap">
            <img id="pdImg" class="pd-hero-img" alt="">
            <div id="pdImgPh" class="pd-img-ph">
              <svg viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="1">
                <rect x="10" y="0" width="12" height="4" rx="1"/>
                <path d="M8 4C4 4 2 8 2 12L2 44C2 46 4 48 6 48L26 48C28 48 30 46 30 44L30 12C30 8 28 4 24 4Z"/>
                <line x1="2" y1="14" x2="30" y2="14"/>
              </svg>
            </div>
            <div id="pdDupeCard" class="pd-dupe-card" style="display:none">
              <img id="pdDupeImg" class="pd-dupe-img" alt="">
              <div class="pd-dupe-info">
                <span class="pd-dupe-label">Se parece a</span>
                <span id="pdDupeName" class="pd-dupe-name"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Columna detalles -->
        <div class="pd-right-col">
          <nav class="pd-breadcrumb">
            <span onclick="closePdModal()">CATÁLOGO</span>
            <span class="pd-bc-sep">›</span>
            <span id="pdBreadBrand"></span>
          </nav>

          <h2 id="pdName" class="pd-product-name"></h2>
          <p id="pdSubtitle" class="pd-product-subtitle"></p>

          <!-- Descripción siempre visible -->
          <p id="pdDesc" class="pd-desc-text"></p>

          <!-- Precio — solo decants -->
          <div id="pdPriceRow" class="pd-price-row"></div>
          <button type="button" id="pdAltHint" class="pd-alt-hint" hidden></button>

          <!-- Tamaños: tarjetas con precio y sprays -->
          <div id="pdSizeSection" class="pd-size-section">
            <p class="pd-notes-section-title">ELIGE TU TAMAÑO</p>
            <div id="pdSizesRow" class="pd-size-cards"></div>
          </div>

          <!-- Preguntas frecuentes (textos en js/store/faq.js) -->
          <div id="pdFaq" class="pd-faq"></div>

          <!-- Combínalo: otros perfumes para sumar al mismo pedido -->
          <div id="pdCombine" class="pd-combine" hidden>
            <p class="pd-notes-section-title">COMBÍNALO</p>
            <p class="pd-combine-sub">Suma otros perfumes a tu pedido con un toque.</p>
            <div id="pdCombineList" class="pd-combine-list"></div>
          </div>

          <!-- Cantidad y total -->
          <div id="pdQtyRow" class="pd-qty-row">
            <div class="pd-qty" role="group" aria-label="Cantidad">
              <button type="button" class="pd-qty-btn" data-qty="-1" aria-label="Quitar uno">−</button>
              <span id="pdQtyVal" class="pd-qty-val" aria-live="polite">1</span>
              <button type="button" class="pd-qty-btn" data-qty="1" aria-label="Agregar uno">+</button>
            </div>
            <p class="pd-total">Total <strong id="pdTotal">S/ 0</strong></p>
          </div>

          <!-- Botones de compra (en el celular quedan fijos abajo) -->
          <div class="pd-actions">
            <button id="pdCartBtn" class="pd-cart-btn" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8"/>
              </svg>
              <span id="pdCartBtnText">Añadir al carrito</span>
            </button>
            <button id="pdBuyBtn" class="pd-buy-btn" type="button">Comprar ahora</button>
          </div>

          <!-- Confianza -->
          ${PD_TRUST_HTML}

          <!-- Momento ideal de uso — Día / Noche -->
          <div id="pdOccasionSection" class="pd-occasion-section">
            <p class="pd-notes-section-title">MOMENTO IDEAL</p>
            <div id="pdOccasionBadge" class="pd-occasion-badge"></div>
          </div>

          <!-- Acordes principales — estilo Fragrantica, siempre visibles -->
          <div id="pdAccordsSection" class="pd-accords-section">
            <p class="pd-notes-section-title">ACORDES PRINCIPALES</p>
            <div id="pdAccordsList" class="pd-accords-list"></div>
          </div>

          <!-- Notas olfativas — siempre visibles -->
          <div id="pdAccNotes" class="pd-notes-section">
            <p class="pd-notes-section-title">NOTAS OLFATIVAS</p>
            <div id="pdNotesList" class="pd-notes-list"></div>
          </div>

        </div>
      </div>

      <!-- Descubre más vibras -->
      <div class="pd-discover-wrap">
        <!-- Alternativas árabes: perfumes del catálogo que se parecen a este -->
        <section class="pd-discover pd-alternatives" id="pdAltSection" hidden>
          <div class="pd-discover-header">
            <h3 class="pd-discover-title">ALTERNATIVAS QUE SE PARECEN</h3>
          </div>
          <p class="pd-alt-sub" id="pdAltSub"></p>
          <div id="pdAltScroll" class="pd-discover-scroll"></div>
        </section>
        <section class="pd-discover">
          <div class="pd-discover-header">
            <h3 class="pd-discover-title">DESCUBRE MÁS VIBRAS</h3>
            <button class="pd-discover-all" onclick="closePdModal()">VER TODO →</button>
          </div>
          <div id="pdDiscoverScroll" class="pd-discover-scroll"></div>
        </section>
      </div>
    </div>
  `;
  const footer = document.querySelector('.footer');
  if (footer) footer.parentNode.insertBefore(el, footer);
  else document.body.appendChild(el);

  el.querySelector('.pd-close').addEventListener('click', () => closePdModal());
  document.getElementById('pdAltHint').addEventListener('click', () => {
    document.getElementById('pdAltSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('keydown', _pdEscHandler);

  // Preguntas frecuentes (mismos textos que la sección "¿Cómo comprar?")
  if (typeof faqForProductHtml === 'function') document.getElementById('pdFaq').innerHTML = faqForProductHtml();

  // Cantidad
  el.querySelectorAll('.pd-qty-btn').forEach(b => b.addEventListener('click', () => {
    _pdQty = Math.max(1, Math.min(10, _pdQty + parseInt(b.dataset.qty)));
    _pdUpdateTotals();
  }));

  // Combínalo: cada casilla cambia el total
  document.getElementById('pdCombineList').addEventListener('change', _pdUpdateTotals);

  // Añadir al carrito (el perfume × cantidad + lo marcado en Combínalo)
  document.getElementById('pdCartBtn').addEventListener('click', () => {
    const btn = document.getElementById('pdCartBtn');
    // En modo WhatsApp (agotado / consultar precio), el onclick del botón ya lo maneja
    if (!_pdProduct || btn.classList.contains('pd-cart-wa')) return;
    if (!_pdSelSize) { _pdPulseSizes(); return; }
    _pdAddSelectionToCart();
    btn.classList.add('added');
    document.getElementById('pdCartBtnText').textContent = '¡Agregado! ✓';
    setTimeout(() => { btn.classList.remove('added'); _pdUpdateTotals(); }, 1800);
    renderProducts();
  });

  // Comprar ahora: agrega lo mismo y va directo a finalizar el pedido
  document.getElementById('pdBuyBtn').addEventListener('click', () => {
    if (!_pdProduct) return;
    if (!_pdSelSize) { _pdPulseSizes(); return; }
    _pdAddSelectionToCart();
    renderProducts();
    const stockErrors = validateCartStock();
    if (stockErrors.length) { showStockAlert(stockErrors); return; }
    Cart.hideCart();
    Checkout.open();
  });
}

// Sin talla elegida: llevar al selector y resaltarlo
function _pdPulseSizes() {
  const sec = document.getElementById('pdSizeSection');
  sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  sec.classList.remove('pd-size-pulse');
  void sec.offsetWidth;
  sec.classList.add('pd-size-pulse');
}

// Tarjeta de un tamaño: precio, sprays aproximados y etiqueta opcional
function _pdSizeCardHtml({ size, price, off = false, note = '', badge = '', before = 0 }) {
  const noteTxt = off ? (price > 0 ? 'Agotado' : 'Pronto') : note;
  return `
    <button type="button" class="pd-size-card ${off ? 'pd-size-off' : ''}" data-size="${escapeAttr(size)}" data-price="${price}"
            ${off ? 'disabled aria-disabled="true"' : ''}>
      ${badge ? `<span class="pd-size-badge">${badge}</span>` : ''}
      <span class="pd-size-ml">${sanitize(size)}</span>
      ${before ? `<s class="pd-size-before">S/ ${before}</s>` : ''}
      <span class="pd-size-price">${price > 0 ? `S/ ${price}` : '—'}</span>
      ${noteTxt ? `<span class="pd-size-note">${noteTxt}</span>` : ''}
    </button>`;
}

// ~10 sprays por ml (mismo cálculo que "¿Qué tamaño me conviene?" en faq.js)
function _pdSpraysNote(size) {
  const ml = parseFloat(size);
  return isNaN(ml) ? '' : `~${Math.round(ml * 10)} sprays`;
}

const _pdMoney = n => (Math.round(n * 100) / 100).toString();

// Perfumes marcados en "Combínalo"
function _pdCheckedExtras() {
  const all = _allProducts || Products.getAll();
  return [...document.querySelectorAll('#pdCombineList .pd-combine-check:checked')].map(i => ({
    product: all.find(x => x.id === parseInt(i.dataset.id)),
    size:    i.dataset.size,
    price:   parseFloat(i.dataset.price) || 0
  })).filter(x => x.product && x.price > 0);
}

function _pdUpdateTotals() {
  document.getElementById('pdQtyVal').textContent = _pdQty;
  const total = (_pdSelPrice || 0) * _pdQty + _pdCheckedExtras().reduce((s, x) => s + x.price, 0);
  document.getElementById('pdTotal').textContent = `S/ ${_pdMoney(total)}`;
  const btn = document.getElementById('pdCartBtn');
  if (btn.classList.contains('pd-cart-wa') || btn.classList.contains('added')) return;
  document.getElementById('pdCartBtnText').textContent = _pdSelSize ? `Añadir · S/ ${_pdMoney(total)}` : 'Elige un tamaño';
}

function _pdAddSelectionToCart() {
  const p = _pdProduct;
  for (let i = 0; i < _pdQty; i++) Cart.add(p, _pdSelSize, _pdSelPrice);
  const extras = _pdCheckedExtras();
  extras.forEach(x => Cart.add(x.product, x.size, x.price));
  const count = _pdQty + extras.length;
  // Listo: desmarcar y volver a 1 para no agregar lo mismo dos veces
  document.querySelectorAll('#pdCombineList .pd-combine-check:checked').forEach(i => { i.checked = false; });
  _pdQty = 1;
  _pdUpdateTotals();
  showCartToast(count > 1 ? `🛍 Agregamos ${count} productos a tu carrito` : `${p.brand} – ${p.name} (${_pdSelSize}) agregado`);
}

// Cantidad, total, Combínalo y "Comprar ahora" solo tienen sentido si se puede comprar
function _pdSetBuyable(on) {
  document.getElementById('pdBuyBtn').hidden = !on;
  document.getElementById('pdQtyRow').hidden = !on;
  if (!on) document.getElementById('pdCombine').hidden = true;
}

// Talla chica para sugerir en "Combínalo" (para probarlo): 3ml, si no 2ml, 5ml o 10ml
function _pdCombineSize(x) {
  for (const s of ['3ml', '2ml', '5ml', '10ml']) {
    if ((x.sizes?.[s] || 0) > 0 && bottleHasMl(x, s)) return s;
  }
  return null;
}

// Sugerencias de "Combínalo": hasta 3 perfumes disponibles, mezclando tipos
// (en un árabe se sugiere primero un diseñador y un nicho, y viceversa), del
// mismo público, priorizando los populares y los de otro momento del día.
function _pdCombineSuggestions(p, all, exclude) {
  if (p.type === 'entero') return [];
  const genderOk = x => p.gender === 'hombre' ? x.gender !== 'mujer'
                      : p.gender === 'mujer'  ? x.gender !== 'hombre' : true;
  const cands = all.filter(x => x.id !== p.id && x.type !== 'entero' && !exclude.has(x.id)
                             && isDecantPurchasable(x) && genderOk(x) && _pdCombineSize(x));
  // pequeño desempate distinto por perfume, para que no se sugieran siempre los mismos
  const score = x => (x.featured ? 2 : 0) + (x.occasion !== p.occasion ? 1 : 0)
                   + (x.olfFamily !== p.olfFamily ? .5 : 0) + ((x.id * 7 + p.id * 13) % 10) / 25;
  cands.sort((a, b) => score(b) - score(a));
  const order = p.type === 'arabe' ? ['diseñador', 'nicho', 'arabe']
              : p.type === 'nicho' ? ['arabe', 'diseñador', 'nicho']
              :                      ['arabe', 'nicho', 'diseñador'];
  const picks = [];
  order.forEach(t => { const x = cands.find(c => c.type === t); if (x) picks.push(x); });
  for (const x of cands) { if (picks.length >= 3) break; if (!picks.includes(x)) picks.push(x); }
  return picks.slice(0, 3).map(x => { const size = _pdCombineSize(x); return { product: x, size, price: x.sizes[size] }; });
}

function openPdModal(productId, { fromHistory = false } = {}) {
  _createPdModal();
  const p = _allProducts?.find(x => x.id === productId) ?? Products.getById(productId);
  if (!p) return;

  const wasOpen = _anyDetailOpen();
  if (!wasOpen) _pdReturnY = window.scrollY;
  if (!fromHistory) {
    _pdDepth = wasOpen ? _pdDepth + 1 : 1;
    try { history.pushState({ pd: p.id, depth: _pdDepth }, '', _pdUrl(p.id)); } catch (_) {}
  }
  document.getElementById('cdModal')?.classList.remove('open');   // venía de un combo

  _pdProduct  = p;
  _pdSelSize  = null;
  _pdSelPrice = 0;
  if (typeof RecentlyViewed !== 'undefined') RecentlyViewed.add(p.id);
  const all = _allProducts || Products.getAll();

  const isEntero    = p.type === 'entero';
  const typeLabel   = isEntero ? 'Perfume Entero' : productTypeInfo(p.type).label;
  const occasionLbl = { dia: 'Día', noche: 'Noche', ambas: 'Día & Noche' }[p.occasion] || '';

  // ── Imagen ───────────────────────────────────────────────
  const imgEl = document.getElementById('pdImg');
  const imgPh = document.getElementById('pdImgPh');
  if (p.imageUrl) {
    imgEl.src = p.imageUrl;
    imgEl.alt = `${p.brand} ${p.name}`;
    imgEl.style.display = 'block';
    imgPh.style.display = 'none';
    imgEl.onerror = () => { imgEl.style.display = 'none'; imgPh.style.display = 'flex'; };
  } else {
    imgEl.style.display = 'none';
    imgPh.style.display = 'flex';
  }

  // ── "Se parece a" (perfume de diseñador que dupea/inspira) ──
  const dupeCard = document.getElementById('pdDupeCard');
  const dupeImg  = document.getElementById('pdDupeImg');
  const dupeName = document.getElementById('pdDupeName');
  if (p.dupeOf && p.dupeOf.name) {
    dupeName.textContent = [p.dupeOf.name, p.dupeOf.brand].filter(Boolean).join(' · ');
    if (p.dupeOf.imageUrl) {
      dupeImg.src = p.dupeOf.imageUrl;
      dupeImg.style.display = 'block';
      dupeImg.onerror = () => { dupeImg.style.display = 'none'; };
    } else {
      dupeImg.removeAttribute('src');
      dupeImg.style.display = 'none';
    }
    dupeCard.style.display = 'flex';
    const original = originalFor(p, all);
    dupeCard.classList.toggle('pd-dupe-link', !!original);
    dupeCard.onclick = original ? () => openPdModal(original.id) : null;
    dupeCard.title = original ? `Ver ${original.name}` : '';
  } else {
    dupeCard.style.display = 'none';
    dupeCard.onclick = null;
  }

  // ── Breadcrumb + Nombre ──────────────────────────────────
  document.getElementById('pdBreadBrand').textContent = p.brand.toUpperCase();
  document.getElementById('pdName').textContent = p.name;
  const subtitleParts = [typeLabel, p.olfFamily, occasionLbl].filter(Boolean);
  document.getElementById('pdSubtitle').innerHTML = subtitleParts
    .map(s => `<span>${sanitize(s)}</span>`)
    .join('<span style="opacity:.3;margin:0 .1rem">·</span>');

  // ── Precio (solo decants) ────────────────────────────────
  const priceRow = document.getElementById('pdPriceRow');
  if (!isEntero) {
    const positiveSizes = Object.values(p.sizes).filter(v => v > 0);
    const minPrice = positiveSizes.length ? Math.min(...positiveSizes) : 0;
    priceRow.innerHTML = minPrice > 0
      ? `<span class="pd-price-from">Desde</span> <strong class="pd-price-main">S/ ${minPrice}</strong>`
      : `<span class="pd-price-consultar">Consultar precio</span>`;
    priceRow.style.display = 'flex';
  } else {
    // Entero: precio viene de enteroPrice (decant→entero) o de sizes (entero nativo)
    const _sizePrices  = Object.values(p.sizes || {}).filter(v => v > 0);
    const enteroPrice  = p.enteroPrice > 0 ? p.enteroPrice : (_sizePrices.length ? Math.min(..._sizePrices) : 0);
    if (enteroPrice > 0) {
      priceRow.innerHTML = `<strong class="pd-price-main">S/ ${enteroPrice}</strong>`;
    } else {
      const waText = encodeURIComponent(`Hola, me interesa el perfume ${p.brand} – ${p.name}. ¿Cuál es el precio?`);
      priceRow.innerHTML = `<a href="https://wa.me/51917452643?text=${waText}" target="_blank" rel="noopener noreferrer" class="pd-consult-wa">
        <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Consultar precio por WhatsApp
      </a>`;
    }
    priceRow.style.display = 'flex';
  }

  // ── Tamaños: tarjetas con precio y sprays ────────────────
  const sizesRow = document.getElementById('pdSizesRow');
  const cartBtn  = document.getElementById('pdCartBtn');
  const cartTxt  = document.getElementById('pdCartBtnText');
  cartBtn.classList.remove('added', 'pd-cart-wa', 'pd-cart-pick');
  cartBtn.onclick  = null;
  cartBtn.disabled = false;
  _pdQty = 1;
  _pdSetBuyable(true);

  const selectSize = (size, price) => {
    _pdSelSize  = size;
    _pdSelPrice = price;
    sizesRow.querySelectorAll('.pd-size-card').forEach(c => c.classList.toggle('active', c.dataset.size === size));
    const before = sizeBeforePrice(p, size, price);
    priceRow.innerHTML = `${before ? `<s class="pd-price-before">S/ ${before}</s> ` : ''}<strong class="pd-price-main">S/ ${price}</strong>`
      + (before ? ` <span class="pd-price-off">-${Math.round((1 - price / before) * 100)}%</span>` : '');
    _pdUpdateTotals();
  };

  if (isEntero) {
    // Frasco entero: una sola opción con su clave REAL ("Unidad", "Set"…), que
    // es la que valida la base de datos (antes se mandaba siempre "Unidad" y
    // un gift set con clave "Set" quedaba rechazado)
    const [sizeKey, sizePrice] = Object.entries(p.sizes || {}).find(([, v]) => v > 0) || ['Unidad', 0];
    const price = sizePrice > 0 ? sizePrice : (p.enteroPrice > 0 ? p.enteroPrice : 0);
    if (!p.inStock) {
      sizesRow.innerHTML = _pdSizeCardHtml({ size: sizeKey, price, off: true });
      _pdSetNotify(cartBtn, cartTxt, p);
    } else if (price > 0) {
      sizesRow.innerHTML = _pdSizeCardHtml({ size: sizeKey, price, note: 'Frasco completo' });
      selectSize(sizeKey, price);
    } else {
      // Sin precio en el panel → consultar por WhatsApp
      sizesRow.innerHTML = '';
      _pdSetBuyable(false);
      cartBtn.classList.add('pd-cart-wa');
      cartTxt.textContent = '💬 Consultar por WhatsApp';
      const waText = encodeURIComponent(`Hola, me interesa el perfume ${p.brand} – ${p.name}. ¿Cuál es el precio?`);
      cartBtn.onclick = e => { e.preventDefault(); window.open(`https://wa.me/51917452643?text=${waText}`, '_blank'); };
    }
  } else {
    const entries = Object.entries(p.sizes || {});
    const avail   = ([ml, price]) => p.inStock && bottleHasMl(p, ml) && price > 0;
    sizesRow.innerHTML = entries.map(e => _pdSizeCardHtml({
      size: e[0], price: e[1], off: !avail(e), note: _pdSpraysNote(e[0]), before: sizeBeforePrice(p, e[0], e[1]),
      badge: e[0] === BEST_SELLER_SIZE && avail(e) ? 'MÁS VENDIDO' : ''
    })).join('');
    // Viene elegida la más vendida (o la primera disponible)
    const pick = entries.find(e => e[0] === BEST_SELLER_SIZE && avail(e)) || entries.find(avail);
    if (pick) selectSize(pick[0], pick[1]);
    else _pdSetNotify(cartBtn, cartTxt, p);
  }
  sizesRow.querySelectorAll('.pd-size-card:not([disabled])').forEach(card => {
    card.addEventListener('click', () => selectSize(card.dataset.size, parseFloat(card.dataset.price)));
  });

  // ── Descripción ──────────────────────────────────────────
  document.getElementById('pdDesc').textContent = p.description || '';

  // ── Momento ideal de uso (Día / Noche) ───────────────────
  const OCCASION_INFO = {
    dia:   { icon: '☀️',  cls: 'pd-occ-dia',   text: 'Ideal para el día' },
    noche: { icon: '🌙',  cls: 'pd-occ-noche', text: 'Ideal para la noche' },
    ambas: { icon: '☀️🌙', cls: 'pd-occ-ambas', text: 'Ideal para el día y la noche' }
  };
  const occSection = document.getElementById('pdOccasionSection');
  const occBadge   = document.getElementById('pdOccasionBadge');
  const occInfo    = OCCASION_INFO[p.occasion];
  if (occInfo) {
    occBadge.className = `pd-occasion-badge ${occInfo.cls}`;
    occBadge.innerHTML = `<span class="pd-occasion-icon">${occInfo.icon}</span><span class="pd-occasion-text">${occInfo.text}</span>`;
    occSection.style.display = 'block';
  } else {
    occBadge.innerHTML = '';
    occSection.style.display = 'none';
  }

  // ── Acordes principales (estilo Fragrantica) ─────────────
  const accordsList = document.getElementById('pdAccordsList');
  const accordsSec  = document.getElementById('pdAccordsSection');
  if (Array.isArray(p.accords) && p.accords.length) {
    const maxPct = Math.max(...p.accords.map(a => a.pct || 0), 1);
    accordsList.innerHTML = p.accords.map(a => {
      const bg   = accordColor(a.name);
      const fg   = accordTextColor(bg);
      const wPct = Math.max(28, Math.round((a.pct || 0) / maxPct * 100));
      return `<div class="pd-accord-bar" style="width:${wPct}%;background:${bg};color:${fg}">${sanitize(a.name)}</div>`;
    }).join('');
    accordsSec.style.display = 'block';
  } else {
    accordsList.innerHTML = '';
    accordsSec.style.display = 'none';
  }

  // ── Notas olfativas ──────────────────────────────────────
  const notesList = document.getElementById('pdNotesList');
  const notesAcc  = document.getElementById('pdAccNotes');
  if (!isEntero && (p.topNotes || p.heartNotes || p.baseNotes)) {
    notesList.innerHTML = [
      p.topNotes    ? `<div class="pd-note-glass pd-note-top">
        <div class="pd-note-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path stroke-linecap="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
        </div>
        <div><p class="pd-note-tier-lbl">SALIDA</p><p class="pd-note-tier-val">${sanitize(p.topNotes)}</p></div>
      </div>` : '',
      p.heartNotes  ? `<div class="pd-note-glass pd-note-heart">
        <div class="pd-note-icon-wrap">
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
        </div>
        <div><p class="pd-note-tier-lbl">CORAZÓN</p><p class="pd-note-tier-val">${sanitize(p.heartNotes)}</p></div>
      </div>` : '',
      p.baseNotes   ? `<div class="pd-note-glass pd-note-base">
        <div class="pd-note-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path stroke-linecap="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>
        <div><p class="pd-note-tier-lbl">FONDO</p><p class="pd-note-tier-val">${sanitize(p.baseNotes)}</p></div>
      </div>` : ''
    ].filter(Boolean).join('');
    notesAcc.style.display = 'block';
  } else {
    notesList.innerHTML = '';
    notesAcc.style.display = 'none';
  }

  // ── Alternativas que se parecen (ej. árabes parecidos a Dior Sauvage) ──
  const alts = alternativesFor(p, all).filter(productIsPurchasable)
    .sort((a, b) => (productMinPrice(a) || Infinity) - (productMinPrice(b) || Infinity));
  const altSection = document.getElementById('pdAltSection');
  const altHint    = document.getElementById('pdAltHint');
  altSection.hidden = !alts.length;
  altHint.hidden    = !alts.length;
  if (alts.length) {
    const cheapest = alts.map(x => productMinPrice(x)).filter(v => v > 0);
    const from = cheapest.length ? Math.min(...cheapest) : 0;
    altHint.innerHTML = `💡 ${alts.length === 1 ? 'Hay 1 alternativa que se parece' : `Hay ${alts.length} alternativas que se parecen`}${from > 0 ? `, desde <strong>S/ ${from}</strong>` : ''} ↓`;
    document.getElementById('pdAltSub').textContent = `Perfumes árabes con un aroma parecido a ${p.name}, a un precio más accesible.`;
    document.getElementById('pdAltScroll').innerHTML = alts.map(productMiniCardHtml).join('');
    bindMiniCards(document.getElementById('pdAltScroll'));
  } else {
    document.getElementById('pdAltScroll').innerHTML = '';
  }

  // ── Combínalo ─────────────────────────────────────────────
  const altIds  = new Set(alts.map(x => x.id));
  const extras  = _pdSelSize ? _pdCombineSuggestions(p, all, altIds) : [];
  const combine = document.getElementById('pdCombine');
  document.getElementById('pdCombineList').innerHTML = extras.map(({ product: x, size, price }) => {
    const t = productTypeInfo(x.type);
    return `
    <label class="pd-combine-item">
      <input type="checkbox" class="pd-combine-check" data-id="${x.id}" data-size="${escapeAttr(size)}" data-price="${price}">
      <span class="pd-combine-thumb">${x.imageUrl ? `<img src="${escapeAttr(x.imageUrl)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}</span>
      <span class="pd-combine-info">
        <span class="pd-combine-name">${sanitize(x.name)}</span>
        <span class="pd-combine-meta"><span class="pd-combine-type ${t.badge}">${t.label}</span>${sanitize(x.brand)} · ${sanitize(size)}</span>
      </span>
      <span class="pd-combine-price">S/ ${price}</span>
    </label>`;
  }).join('');
  combine.hidden = !extras.length;
  extras.forEach(x => altIds.add(x.product.id));   // y no repetirlos en "Descubre más"
  _pdUpdateTotals();

  // ── Descubre más vibras ───────────────────────────────────
  const similar = all
    .filter(x => {
      if (x.id === p.id || altIds.has(x.id) || !productIsPurchasable(x)) return false;
      if (p.gender === 'hombre') return x.gender === 'hombre' || x.gender === 'unisex';
      if (p.gender === 'mujer')  return x.gender === 'mujer'  || x.gender === 'unisex';
      return true;
    })
    .sort((a, b) => {
      const aScore = (a.olfFamily === p.olfFamily ? 2 : 0) + (a.type === p.type ? 1 : 0);
      const bScore = (b.olfFamily === p.olfFamily ? 2 : 0) + (b.type === p.type ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 6);

  document.getElementById('pdDiscoverScroll').innerHTML = similar.map(productMiniCardHtml).join('');
  bindMiniCards(document.getElementById('pdDiscoverScroll'));

  // Ocultar secciones del catálogo
  document.querySelectorAll(_PD_HIDE_SELECTOR).forEach(el => el.classList.add('pd-page-hidden'));
  document.body.classList.add('pd-open');

  const modal = document.getElementById('pdModal');
  modal.classList.add('open');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Cierra el detalle y vuelve al catálogo. `restoreScroll: false` cuando quien
// llama va a hacer su propio scroll (ej. un link del menú).
function closePdModal({ restoreScroll = true } = {}) {
  const depth = _pdDepth;
  _pdHide(restoreScroll);
  // Sacar del historial los perfumes apilados (el popstate que llega después
  // no hace nada porque el detalle ya está cerrado)
  if (depth > 0 && (Number.isInteger(history.state?.pd) || Number.isInteger(history.state?.combo))) history.go(-depth);
}

function _pdHide(restoreScroll) {
  _pdDepth = 0;
  const open = document.querySelectorAll('.pd-modal.open');   // perfume o combo
  if (!open.length) return;
  open.forEach(m => m.classList.remove('open'));
  document.body.classList.remove('pd-open');
  document.querySelectorAll('.pd-page-hidden').forEach(el => el.classList.remove('pd-page-hidden'));
  if (typeof renderRecentlyViewed === 'function') renderRecentlyViewed();
  if (restoreScroll) window.scrollTo({ top: _pdReturnY, behavior: 'instant' });
  if (window.ScrollTrigger) ScrollTrigger.refresh();
}
