// ─── Modal de detalle de producto (v2) ────────────────────────────────────────

let _pdProduct  = null;
let _pdSelSize  = null;
let _pdSelPrice = 0;

// ─── El detalle es una "página" más del historial ────────────────────────────
// Cada perfume abierto agrega una entrada (?p=ID). Así el botón "atrás" del
// celular vuelve al catálogo en vez de sacar al cliente de la tienda, y el
// catálogo reaparece en el mismo lugar donde lo dejó.
let _pdReturnY = 0;   // posición del catálogo al abrir el primer perfume
let _pdDepth   = 0;   // perfumes apilados en el historial desde el catálogo

try { history.scrollRestoration = 'manual'; } catch (_) {}

function _pdUrl(id) {
  const params = new URLSearchParams(location.search);
  if (id) params.set('p', id); else params.delete('p');
  const qs = params.toString();
  return location.pathname + (qs ? '?' + qs : '');
}

// Todo lo que va entre el header y el footer es "catálogo" y se oculta mientras
// se ve un perfume (antes era una lista fija y la sección Combos quedaba visible
// encima del detalle).
const _PD_HIDE_SELECTOR = 'body > section, body > main, body > .marquee-strip, body > .parallax-divider, body > #catalogBanner';

window.addEventListener('popstate', e => {
  const st = e.state;
  if (st && st.pd) {
    _pdDepth = st.depth || 1;
    openPdModal(st.pd, { fromHistory: true });
  } else {
    _pdHide(true);
  }
});

function _pdEscHandler(e) {
  if (e.key === 'Escape' && document.getElementById('pdModal')?.classList.contains('open')) closePdModal();
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

          <!-- Selector de tamaño -->
          <div id="pdSizeSection" class="pd-size-section">
            <div class="pd-size-header">
              <span class="pd-size-label">SELECCIONAR TAMAÑO</span>
              <button id="pdGuideBtn" class="pd-guide-link">Guía de decants</button>
            </div>
            <div id="pdSizesRow" class="pd-sizes-grid"></div>
            <div id="pdGuideTooltip" class="pd-guide-tooltip" style="display:none">
              <p class="pd-guide-title">¿Cuánto dura cada decant?</p>
              <div id="pdGuideRows" class="pd-guide-rows"></div>
              <p class="pd-guide-note">Basado en 2-3 sprays por uso diario</p>
            </div>

            <!-- Visualizador Interactivo de Frascos (Decants) -->
            <div id="pdDecantVisualizer" class="pd-decant-visualizer" style="display:none">
              <div class="pd-visual-bottles">
                <!-- Botella 2ml -->
                <div class="pd-visual-bottle-card" data-visual-size="2ml">
                  <div class="pd-bottle-cap"></div>
                  <div class="pd-bottle-body size-2ml">
                    <div class="pd-bottle-liquid"></div>
                    <span class="pd-bottle-label-ml">2ml</span>
                  </div>
                </div>
                <!-- Botella 3ml -->
                <div class="pd-visual-bottle-card" data-visual-size="3ml">
                  <div class="pd-bottle-cap"></div>
                  <div class="pd-bottle-body size-3ml">
                    <div class="pd-bottle-liquid"></div>
                    <span class="pd-bottle-label-ml">3ml</span>
                  </div>
                </div>
                <!-- Botella 5ml -->
                <div class="pd-visual-bottle-card" data-visual-size="5ml">
                  <div class="pd-bottle-cap"></div>
                  <div class="pd-bottle-body size-5ml">
                    <div class="pd-bottle-liquid"></div>
                    <span class="pd-bottle-label-ml">5ml</span>
                  </div>
                </div>
                <!-- Botella 10ml -->
                <div class="pd-visual-bottle-card" data-visual-size="10ml">
                  <div class="pd-bottle-cap"></div>
                  <div class="pd-bottle-body size-10ml">
                    <div class="pd-bottle-liquid"></div>
                    <span class="pd-bottle-label-ml">10ml</span>
                  </div>
                </div>
              </div>
              
              <!-- Stats de duración y rendimiento -->
              <div class="pd-visual-stats">
                <div class="pd-stat-item">
                  <div class="pd-stat-lbl-row">
                    <span class="pd-stat-lbl">RENDIMIENTO APROX.</span>
                    <span id="pdStatValSprays" class="pd-stat-val">~0 sprays</span>
                  </div>
                  <div class="pd-stat-bar-container">
                    <div id="pdStatBarSprays" class="pd-stat-bar" style="width: 0%"></div>
                  </div>
                </div>
                <div class="pd-stat-item pd-stat-duration-box">
                  <span class="pd-stat-lbl">DURACIÓN ESTIMADA</span>
                  <span id="pdStatValDuration" class="pd-stat-val-highlight">Selecciona un tamaño</span>
                </div>
              </div>
            </div>
          </div>

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

          <!-- Botón carrito -->
          <div class="pd-actions">
            <button id="pdCartBtn" class="pd-cart-btn" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h8"/>
              </svg>
              <span id="pdCartBtnText">Selecciona un tamaño</span>
            </button>
          </div>

          <!-- Trust badges -->
          <div class="pd-trust">
            <div class="pd-trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span>Originalidad<br>Garantizada</span>
            </div>
            <div class="pd-trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              <span>Envío a<br>Todo el Perú</span>
            </div>
            <div class="pd-trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path stroke-linecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <span>Pago<br>Seguro</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Descubre más vibras -->
      <div class="pd-discover-wrap">
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
  document.addEventListener('keydown', _pdEscHandler);

  // Guía de decants: toggle tooltip
  document.getElementById('pdGuideBtn').addEventListener('click', e => {
    e.stopPropagation();
    const tt = document.getElementById('pdGuideTooltip');
    tt.style.display = tt.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('pdCartBtn').addEventListener('click', () => {
    // Si está en modo WhatsApp, el onclick del botón ya lo maneja
    if (!_pdProduct || document.getElementById('pdCartBtn').classList.contains('pd-cart-wa')) return;
    if (!_pdSelSize) {
      // Sin talla elegida: llevar al selector y resaltarlo (la barra está fija
      // abajo en el celular, lejos de los botones de talla)
      const sec = document.getElementById('pdSizeSection');
      sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sec.classList.remove('pd-size-pulse');
      void sec.offsetWidth;
      sec.classList.add('pd-size-pulse');
      return;
    }
    Cart.add(_pdProduct, _pdSelSize, _pdSelPrice);
    const btn = document.getElementById('pdCartBtn');
    const txt = document.getElementById('pdCartBtnText');
    btn.classList.add('added');
    txt.textContent = '¡Agregado al carrito! ✓';
    setTimeout(() => {
      btn.classList.remove('added');
      txt.textContent = `AÑADIR AL CARRITO — S/ ${_pdSelPrice}`;
    }, 2000);
    renderProducts();
  });
}

function openPdModal(productId, { fromHistory = false } = {}) {
  _createPdModal();
  const p = _allProducts?.find(x => x.id === productId) ?? Products.getById(productId);
  if (!p) return;

  const wasOpen = document.getElementById('pdModal').classList.contains('open');
  if (!wasOpen) _pdReturnY = window.scrollY;
  if (!fromHistory) {
    _pdDepth = wasOpen ? _pdDepth + 1 : 1;
    try { history.pushState({ pd: p.id, depth: _pdDepth }, '', _pdUrl(p.id)); } catch (_) {}
  }

  _pdProduct  = p;
  _pdSelSize  = null;
  _pdSelPrice = 0;

  const isEntero    = p.type === 'entero';
  const typeLabel   = p.type === 'arabe' ? 'Árabe' : isEntero ? 'Perfume Entero' : 'Diseñador';
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
  } else {
    dupeCard.style.display = 'none';
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

  // ── Guía de decants (solo decants) ──────────────────────
  const guideBtn = document.getElementById('pdGuideBtn');
  const decantVisualizer = document.getElementById('pdDecantVisualizer');
  document.getElementById('pdGuideTooltip').style.display = 'none';
  guideBtn.style.display = isEntero ? 'none' : 'inline-block';

  if (!isEntero) {
    document.getElementById('pdGuideRows').innerHTML = Object.keys(p.sizes).map(ml => {
      const n = parseFloat(ml);
      if (isNaN(n)) return '';
      const sprays   = Math.round(n / 0.1);
      const weeksMin = Math.max(1, Math.round((n / 0.3) / 7));
      const weeksMax = Math.max(1, Math.round((n / 0.2) / 7));
      const dur = weeksMax < 2 ? `${Math.round(n/0.3)}-${Math.round(n/0.2)} días`
                               : `${weeksMin}-${weeksMax} semanas`;
      return `<div class="pd-guide-row">
        <span class="pd-guide-ml">${sanitize(ml)}</span>
        <span class="pd-guide-sprays">~${sprays} sprays</span>
        <span class="pd-guide-dur">${dur}</span>
      </div>`;
    }).join('');

    // Mostrar visualizador
    if (decantVisualizer) {
      decantVisualizer.style.display = 'block';
      // Resetear visualizador
      decantVisualizer.querySelectorAll('.pd-visual-bottle-card').forEach(c => c.classList.remove('active'));
      document.getElementById('pdStatBarSprays').style.width = '0%';
      document.getElementById('pdStatValSprays').textContent = '~0 sprays';
      document.getElementById('pdStatValDuration').textContent = 'Selecciona un tamaño';
    }
  } else {
    if (decantVisualizer) decantVisualizer.style.display = 'none';
  }

  // ── Botones de tamaño ────────────────────────────────────
  const sizesRow = document.getElementById('pdSizesRow');
  const cartBtn  = document.getElementById('pdCartBtn');
  const cartTxt  = document.getElementById('pdCartBtnText');
  cartBtn.classList.remove('added');

  if (isEntero) {
    const _sp  = Object.values(p.sizes || {}).filter(v => v > 0);
    const price = p.enteroPrice > 0 ? p.enteroPrice : (_sp.length ? Math.min(..._sp) : 0);
    cartBtn.classList.remove('pd-cart-wa', 'pd-cart-pick');
    cartBtn.onclick = null;

    if (!p.inStock) {
      // Agotado
      sizesRow.innerHTML = `<button class="pd-size-btn-new pd-size-disabled" disabled>Unidad</button>`;
      cartBtn.disabled = true;
      cartTxt.textContent = 'Agotado';
    } else if (price > 0) {
      // Precio configurado en admin → agregar al carrito
      sizesRow.innerHTML = `<button class="pd-size-btn-new active" data-size="Unidad" data-price="${price}">Unidad</button>`;
      _pdSelSize  = 'Unidad';
      _pdSelPrice = price;
      cartBtn.disabled = false;
      cartTxt.textContent = `AÑADIR AL CARRITO — S/ ${price}`;
    } else {
      // Sin precio en admin → botón WhatsApp
      sizesRow.innerHTML = '';
      cartBtn.disabled = false;
      cartBtn.classList.add('pd-cart-wa');
      cartTxt.textContent = '💬 Consultar por WhatsApp';
      const waText = encodeURIComponent(`Hola, me interesa el perfume ${p.brand} – ${p.name}. ¿Cuál es el precio?`);
      cartBtn.onclick = (e) => {
        e.preventDefault();
        window.open(`https://wa.me/51917452643?text=${waText}`, '_blank');
      };
    }
  } else {
    cartBtn.classList.remove('pd-cart-wa');
    cartBtn.onclick = null;
    const anySizeOn = Object.entries(p.sizes).some(([ml, price]) => p.inStock && bottleHasMl(p, ml) && price > 0);
    // Con tallas disponibles el botón queda activo: si aún no eligió talla, lo
    // lleva al selector (ver listener en _createPdModal)
    cartBtn.disabled = !anySizeOn;
    cartBtn.classList.toggle('pd-cart-pick', anySizeOn);
    cartTxt.textContent = anySizeOn ? 'Elige un tamaño' : 'Agotado';
    sizesRow.innerHTML = Object.entries(p.sizes).map(([ml, price]) => {
      const sizeOff = !p.inStock || !bottleHasMl(p, ml) || price === 0;
      return `
      <button class="pd-size-btn-new ${sizeOff ? 'pd-size-disabled' : ''}"
              data-size="${escapeAttr(ml)}" data-price="${price}"
              ${sizeOff ? 'disabled' : ''}>
        ${sanitize(ml)}
      </button>`;
    }).join('');

    const selectVisualSize = (sizeStr) => {
      if (isEntero || !decantVisualizer) return;
      const sizeVal = parseFloat(sizeStr);
      let pct = 0;
      let spraysText = '~0 sprays';
      let durText = '';
      if (sizeVal <= 2.5) {
        pct = 18; spraysText = '~15-20 sprays'; durText = '🧪 2 a 5 días (Ideal para probar)';
      } else if (sizeVal <= 3.5) {
        pct = 33; spraysText = '~30-45 sprays'; durText = '🔥 5 a 10 días (Ideal para probar)';
      } else if (sizeVal <= 6) {
        pct = 60; spraysText = '~50-75 sprays'; durText = '✈️ 12 a 18 días (Ideal para viajes)';
      } else {
        pct = 100; spraysText = '~100-150 sprays'; durText = '👑 25 a 35 días (Uso continuo)';
      }

      decantVisualizer.querySelectorAll('.pd-visual-bottle-card').forEach(c => {
        const cSize = c.dataset.visualSize;
        if (cSize === sizeStr || (cSize === '2ml' && sizeVal <= 2.5) || (cSize === '3ml' && sizeVal > 2.5 && sizeVal <= 3.5) || (cSize === '5ml' && sizeVal > 3.5 && sizeVal <= 6) || (cSize === '10ml' && sizeVal > 6)) {
          c.classList.add('active');
          if (window.gsap) {
            window.gsap.fromTo(c, { scale: 0.95 }, { scale: 1.08, duration: 0.4, ease: "back.out(2.5)" });
          }
        } else {
          c.classList.remove('active');
        }
      });
      
      if (window.gsap) {
        window.gsap.to('#pdStatBarSprays', { width: pct + '%', duration: 0.5, ease: "power2.out" });
      } else {
        const bar = document.getElementById('pdStatBarSprays');
        if (bar) bar.style.width = pct + '%';
      }
      const valSprays = document.getElementById('pdStatValSprays');
      if (valSprays) valSprays.textContent = spraysText;
      const valDuration = document.getElementById('pdStatValDuration');
      if (valDuration) valDuration.textContent = durText;
    };

    sizesRow.querySelectorAll('.pd-size-btn-new:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        sizesRow.querySelectorAll('.pd-size-btn-new').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _pdSelSize  = btn.dataset.size;
        _pdSelPrice = parseFloat(btn.dataset.price);
        cartBtn.disabled = false;
        cartBtn.classList.remove('pd-cart-pick');
        cartTxt.textContent = `AÑADIR AL CARRITO — S/ ${_pdSelPrice}`;
        cartBtn.classList.remove('added');
        priceRow.innerHTML = _pdSelPrice > 0
          ? `<strong class="pd-price-main">S/ ${_pdSelPrice}</strong>`
          : `<span class="pd-price-consultar">Consultar precio</span>`;

        selectVisualSize(btn.dataset.size);
      });
    });

    // Vincular clics en las botellitas visuales hacia los botones de tamaño
    if (decantVisualizer) {
      decantVisualizer.querySelectorAll('.pd-visual-bottle-card').forEach(card => {
        // Clonar para evitar listeners duplicados al reabrir modal
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        newCard.addEventListener('click', () => {
          if (!p.inStock) return;
          const targetSize = newCard.dataset.visualSize;
          // Buscar botón de tamaño
          const matchBtn = sizesRow.querySelector(`.pd-size-btn-new[data-size="${targetSize}"]`);
          if (matchBtn) matchBtn.click();
        });
      });
    }
  }

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

  // ── Descubre más vibras ───────────────────────────────────
  const all = _allProducts || Products.getAll();
  const similar = all
    .filter(x => {
      const xPurchasable = x.type === 'entero' ? x.inStock !== false : isDecantPurchasable(x);
      if (x.id === p.id || !xPurchasable) return false;
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

  document.getElementById('pdDiscoverScroll').innerHTML = similar.map(sp => {
    const _spPrices = Object.values(sp.sizes || {}).filter(v => v > 0);
    const spMin = sp.type === 'entero'
      ? (sp.enteroPrice > 0 ? sp.enteroPrice : (_spPrices.length ? Math.min(..._spPrices) : 0))
      : (_spPrices.length ? Math.min(..._spPrices) : 0);
    const spImg = sp.imageUrl
      ? `<img src="${escapeAttr(sp.imageUrl)}" alt="${escapeAttr(sp.name)}" class="pd-mini-img" loading="lazy" onerror="this.style.display='none'">`
      : '';
    return `
      <button class="pd-mini-card" data-id="${sp.id}" aria-label="Ver ${sanitize(sp.name)}">
        <div class="pd-mini-img-wrap">${spImg}</div>
        <div class="pd-mini-info">
          <p class="pd-mini-brand">${sanitize(sp.brand)}</p>
          <p class="pd-mini-name">${sanitize(sp.name)}</p>
          ${spMin > 0 ? `<p class="pd-mini-price">${sp.type === 'entero' ? '' : 'Desde '}S/ ${spMin}</p>` : ''}
        </div>
      </button>`;
  }).join('');

  document.getElementById('pdDiscoverScroll').querySelectorAll('.pd-mini-card').forEach(btn => {
    btn.addEventListener('click', () => openPdModal(parseInt(btn.dataset.id)));
  });

  // Ocultar secciones del catálogo
  document.querySelectorAll(_PD_HIDE_SELECTOR).forEach(el => el.classList.add('pd-page-hidden'));

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
  if (depth > 0 && history.state && history.state.pd) history.go(-depth);
}

function _pdHide(restoreScroll) {
  const modal = document.getElementById('pdModal');
  _pdDepth = 0;
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.remove('open');
  document.querySelectorAll('.pd-page-hidden').forEach(el => el.classList.remove('pd-page-hidden'));
  if (restoreScroll) window.scrollTo({ top: _pdReturnY, behavior: 'instant' });
  if (window.ScrollTrigger) ScrollTrigger.refresh();
}
