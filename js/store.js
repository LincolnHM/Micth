// ─── Carrito + Catálogo con filtros avanzados ─────────────────────────────────

const Cart = {
  items: [],
  _cartOpened: false,

  add(product, size, price) {
    const existing = this.items.find(i => i.productId === product.id && i.size === size);
    if (existing) { existing.quantity++; }
    else {
      this.items.push({ productId: product.id, productName: product.name, brand: product.brand, size, price, quantity: 1, imageUrl: product.imageUrl || '' });
    }
    this.render();
    if (!this._cartOpened) {
      this._cartOpened = true;
      this.showCart();
    }
    this.bounce();
  },

  remove(pid, size)  { this.items = this.items.filter(i => !(i.productId === pid && i.size === size)); this.render(); },
  updateQty(pid, size, qty) {
    const item = this.items.find(i => i.productId === pid && i.size === size);
    if (!item) return;
    qty < 1 ? this.remove(pid, size) : (item.quantity = qty, this.render());
  },
  total()  { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); },
  count()  { return this.items.reduce((s, i) => s + i.quantity, 0); },
  clear()  { this.items = []; this._cartOpened = false; this.render(); if (typeof renderProducts === 'function') renderProducts(); },

  showCart() {
    document.getElementById('cartSidebar').classList.add('open');
    document.getElementById('overlay').classList.add('active');
  },
  hideCart() {
    document.getElementById('cartSidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
  },

  bounce() {
    const btn = document.getElementById('cartBtn');
    btn.classList.add('bounce');
    setTimeout(() => btn.classList.remove('bounce'), 400);
  },

  render() {
    const container = document.getElementById('cartItems');
    const countEl   = document.getElementById('cartCount');
    const totalEl   = document.getElementById('cartTotal');

    const n = this.count();
    countEl.textContent = n;
    countEl.style.display = n > 0 ? 'flex' : 'none';
    totalEl.textContent = `S/ ${this.total().toFixed(2)}`;

    const clearBtn = document.getElementById('clearCartBtn');
    if (clearBtn) clearBtn.style.display = n > 0 ? 'flex' : 'none';

    if (!this.items.length) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">🛍️</div>
          <p>Tu carrito está vacío</p>
          <span>Agrega decants del catálogo</span>
        </div>`;
      return;
    }

    container.innerHTML = this.items.map(item => {
      const imgUrl = item.imageUrl ||
        (_allProducts?.find(p => p.id === item.productId) ?? Products.getById(item.productId))?.imageUrl ||
        '';
      const thumbHtml = imgUrl
        ? `<img src="${imgUrl}" alt="" class="cart-item-thumb" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="cart-item-thumb-ph"><svg viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="10" y="0" width="12" height="4" rx="1"/><path d="M8 4C4 4 2 8 2 12L2 44C2 46 4 48 6 48L26 48C28 48 30 46 30 44L30 12C30 8 28 4 24 4Z"/><line x1="2" y1="14" x2="30" y2="14"/></svg></div>`;
      return `
      <div class="cart-item">
        <div class="cart-item-header">
          ${thumbHtml}
          <div class="cart-item-info">
            <p class="cart-item-name">${sanitize(item.brand)} · ${sanitize(item.productName)}</p>
            <p class="cart-item-size"><span class="decant-chip">${sanitize(item.size)}</span> S/ ${item.price.toFixed(2)} c/u</p>
          </div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" data-id="${item.productId}" data-size="${escapeAttr(item.size)}">−</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn" data-action="inc" data-id="${item.productId}" data-size="${escapeAttr(item.size)}">+</button>
          <button class="remove-btn" data-id="${item.productId}" data-size="${escapeAttr(item.size)}" aria-label="Eliminar">×</button>
        </div>
        <p class="cart-item-sub">S/ ${(item.price * item.quantity).toFixed(2)}</p>
      </div>
    `;
    }).join('');

    container.querySelectorAll('.qty-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id), size = btn.dataset.size;
        const item = Cart.items.find(i => i.productId === id && i.size === size);
        if (item) Cart.updateQty(id, size, item.quantity + (btn.dataset.action === 'inc' ? 1 : -1));
      })
    );
    container.querySelectorAll('.remove-btn').forEach(btn =>
      btn.addEventListener('click', () => Cart.remove(parseInt(btn.dataset.id), btn.dataset.size))
    );
  }
};

function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ─── Búsqueda fuzzy (tolerante a errores de tipeo) ────────────────────────────

function normalizeStr(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fuzzyMatch(query, text) {
  const q = normalizeStr(query);
  const t = normalizeStr(text);
  if (!q) return true;
  if (t.includes(q)) return true;
  const qWords = q.split(/\s+/).filter(w => w.length >= 2);
  if (!qWords.length) return false;
  const tWords = t.split(/\s+/).filter(Boolean);
  // Todas las palabras del query deben encontrar coincidencia en el texto
  return qWords.every(qw => {
    if (tWords.some(tw => tw.includes(qw) || qw.includes(tw))) return true;
    // Tolerancia: 1 error en palabras cortas, 2 en largas
    const maxDist = qw.length <= 4 ? 1 : 2;
    return tWords.some(tw => levenshtein(qw, tw) <= maxDist);
  });
}

// ─── Estado del filtro avanzado ───────────────────────────────────────────────

const Filter = {
  type:      'all',   // all | arabe | diseñador | entero
  gender:    'all',   // all | hombre | mujer | unisex
  occasion:  'all',   // all | dia | noche | ambas
  olfFamily: 'all',   // all | <nombre>
  search:    '',

  reset() { this.type = this.gender = this.occasion = this.olfFamily = 'all'; this.search = ''; },

  apply(products) {
    return products.filter(p => {
      if (this.type === 'entero') {
        if (p.type !== 'entero' && !p.availableAsEntero) return false;
      } else if (this.type !== 'all') {
        if (p.type !== this.type) return false;
      }
      if (this.gender    !== 'all' && p.gender    !== this.gender)    return false;
      if (this.occasion  !== 'all' && p.occasion  !== this.occasion && p.occasion !== 'ambas') return false;
      if (this.olfFamily !== 'all' && p.olfFamily !== this.olfFamily) return false;
      if (this.search) {
        const fields = [p.name, p.brand, p.description || '', p.olfFamily || '', p.contentDescription || ''];
        const qLow   = this.search.toLowerCase();
        if (fields.some(f => f.toLowerCase().includes(qLow))) return true;
        return fields.some(f => fuzzyMatch(this.search, f));
      }
      return true;
    });
  },

  hasActiveFilters() {
    return this.type !== 'all' || this.gender !== 'all' ||
           this.occasion !== 'all' || this.olfFamily !== 'all' || this.search;
  }
};

// ─── Paginación ───────────────────────────────────────────────────────────────

const Pagination = {
  currentPage:    1,
  ITEMS_PER_PAGE: 12,

  reset()              { this.currentPage = 1; },
  totalPages(total)    { return Math.ceil(total / this.ITEMS_PER_PAGE); },
  paginate(items)      {
    const start = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
    return items.slice(start, start + this.ITEMS_PER_PAGE);
  }
};

function renderPagination(current, total) {
  const container = document.getElementById('paginationControls');
  if (!container) return;
  if (total <= 1) { container.innerHTML = ''; return; }

  // Construir lista de páginas con puntos suspensivos
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  container.innerHTML = `
    <nav class="pagination" aria-label="Páginas del catálogo">
      <button class="page-btn page-arrow" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
      ${pages.map(p => p === '…'
        ? `<span class="page-ellipsis">…</span>`
        : `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}" aria-label="Página ${p}" ${p === current ? 'aria-current="page"' : ''}>${p}</button>`
      ).join('')}
      <button class="page-btn page-arrow" data-page="${current + 1}" ${current === total ? 'disabled' : ''} aria-label="Página siguiente">›</button>
    </nav>`;

  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      Pagination.currentPage = parseInt(btn.dataset.page);
      renderProducts();
      // Esperar que GSAP procese las nuevas tarjetas antes de hacer scroll
      // (el MutationObserver de GSAP tiene 65ms de debounce)
      setTimeout(() => {
        if (typeof scrollToSection === 'function') scrollToSection('catalogo');
        else document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      }, 90);
    });
  });
}

// ─── Render del catálogo ──────────────────────────────────────────────────────

let _allProducts = null;

function renderProducts() {
  const grid        = document.getElementById('productsGrid');
  const allFiltered = Filter.apply(_allProducts || Products.getAll());
  // Agotados siempre al fondo
  allFiltered.sort((a, b) => (a.inStock === b.inStock ? 0 : a.inStock ? -1 : 1));
  const totalPages  = Pagination.totalPages(allFiltered.length);

  // Corregir página si excede el total
  if (Pagination.currentPage > totalPages && totalPages > 0) Pagination.currentPage = totalPages;

  const products = Pagination.paginate(allFiltered);

  // Actualizar el contador de resultados
  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    const label = Filter.type === 'entero' ? 'producto' : 'fragancia';
    countEl.textContent = `${allFiltered.length} ${label}${allFiltered.length !== 1 ? 's' : ''}`;
  }

  // Mostrar/ocultar banner de Perfumes Enteros
  const banner = document.getElementById('catalogBanner');
  if (banner) banner.style.display = Filter.type === 'entero' ? 'block' : 'none';

  // Botón limpiar filtros
  const clearBtn = document.getElementById('clearFilters');
  if (clearBtn) clearBtn.style.display = Filter.hasActiveFilters() ? 'flex' : 'none';

  if (!allFiltered.length) {
    grid.innerHTML = `
      <div class="no-results">
        <div style="font-size:2.5rem;margin-bottom:.75rem">🔍</div>
        <p>No se encontraron fragancias con esos filtros.</p>
        <button onclick="resetAllFilters()" class="btn-reset-filter">Limpiar filtros</button>
      </div>`;
    renderPagination(0, 0);
    return;
  }

  grid.innerHTML = products.map(p => {
    const showAsEntero = Filter.type === 'entero' && p.availableAsEntero === true && p.type !== 'entero';
    const isEntero     = p.type === 'entero' || showAsEntero;
    const sizeValues   = isEntero ? [p.enteroPrice || 0] : Object.values(p.sizes);
    const minPrice     = sizeValues.length ? Math.min(...sizeValues) : 0;
    const genderIcon  = { hombre: '♂', mujer: '♀', unisex: '⚥' }[p.gender] || '';
    const occasionLbl = { dia: 'Día', noche: 'Noche', ambas: 'Día & Noche' }[p.occasion] || '';
    const typeLabel   = showAsEntero ? 'Entero' : (p.type === 'arabe' ? 'Árabe' : isEntero ? 'Entero' : 'Diseñador');
    const typeBadge   = showAsEntero ? 'badge-entero' : (p.type === 'arabe' ? 'badge-arabe' : isEntero ? 'badge-entero' : 'badge-dis');


    const sizesHtml = showAsEntero
      ? (() => {
          const price  = p.enteroPrice || 0;
          const inCart = Cart.items.some(i => i.productId === p.id && i.size === 'Unidad');
          return `
      <button class="size-btn ${!p.inStock ? 'disabled' : ''} ${inCart ? 'selected' : ''}"
              data-id="${p.id}" data-size="Unidad" data-price="${price}"
              ${!p.inStock || price === 0 ? 'disabled aria-disabled="true"' : ''}>
        <span class="size-ml">Unidad</span>
        <span class="size-price">${price > 0 ? `S/${price}` : 'Consultar'}</span>
      </button>`;
        })()
      : Object.entries(p.sizes).map(([ml, price]) => {
          const inCart = Cart.items.some(i => i.productId === p.id && i.size === ml);
          const priceDisplay = price > 0 ? `S/${price}` : 'Consultar';
          return `
      <button class="size-btn ${!p.inStock ? 'disabled' : ''} ${inCart ? 'selected' : ''}"
              data-id="${p.id}" data-size="${escapeAttr(ml)}" data-price="${price}"
              ${!p.inStock || (isEntero && price === 0) ? 'disabled aria-disabled="true"' : ''}>
        <span class="size-ml">${sanitize(ml)}</span>
        <span class="size-price">${priceDisplay}</span>
      </button>`;
        }).join('');

    const imgHtml = p.imageUrl
      ? `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(p.name)}" class="product-img" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';

    const waConsultUrl = isEntero && minPrice === 0
      ? `https://wa.me/51917452643?text=${encodeURIComponent(`Hola, me interesa el perfume ${p.brand} – ${p.name}. ¿Cuál es el precio?`)}`
      : '';
    const priceHtml = minPrice > 0
      ? `<p class="price-from">${isEntero ? '' : 'Desde '}<strong>S/ ${minPrice}</strong></p>`
      : isEntero
        ? `<a class="btn-consultar-wa" href="${waConsultUrl}" target="_blank" rel="noopener noreferrer">💬 Consultar precio</a>`
        : `<p class="price-consultar">Consultar precio</p>`;

    return `
      <article class="product-card ${!p.inStock ? 'out-of-stock' : ''} ${p.featured ? 'featured' : ''}">
        <div class="product-img-wrap">
          ${imgHtml}
          <div class="product-img-placeholder" ${p.imageUrl ? 'style="display:none"' : ''}>
            <svg viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
              <rect x="10" y="0" width="12" height="4" rx="1"/>
              <path d="M8 4 C4 4 2 8 2 12 L2 44 C2 46 4 48 6 48 L26 48 C28 48 30 46 30 44 L30 12 C30 8 28 4 24 4 Z"/>
              <line x1="2" y1="14" x2="30" y2="14"/>
            </svg>
          </div>
          <div class="product-badges">
            <span class="badge-type ${typeBadge}">${typeLabel}</span>
            ${p.featured ? '<span class="badge-featured">⭐ Popular</span>' : ''}
          </div>
          ${!p.inStock ? '<div class="out-badge">Agotado</div>' : ''}
          ${p.olfFamily ? `<div class="olf-family-tag">${sanitize(p.olfFamily)}</div>` : ''}
          <button class="pd-open-btn" data-id="${p.id}" aria-label="Ver detalles de ${sanitize(p.name)}">Ver detalles →</button>
        </div>

        <div class="product-info">
          <div class="product-meta-row">
            <span class="product-brand">${sanitize(p.brand)}</span>
            <span class="product-gender" title="Género: ${sanitize(p.gender)}">${genderIcon}</span>
          </div>

          <h3 class="product-name">${sanitize(p.name)}</h3>

          ${p.contentDescription ? `<p class="product-content-desc">${sanitize(p.contentDescription)}</p>` : ''}

          <div class="product-tags">
            ${occasionLbl ? `<span class="tag-occasion">${occasionLbl}</span>` : ''}
          </div>

          <button class="desc-toggle" data-id="${p.id}" aria-expanded="false">
            <span>Ver descripción</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron" aria-hidden="true">
              <path stroke-linecap="round" d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <p class="product-desc" id="desc-${p.id}">${sanitize(p.description)}</p>


          <div class="product-footer">
            ${priceHtml}
            <div class="sizes-row">${sizesHtml}</div>
            <button class="btn-ver-detalle" data-id="${p.id}">
              Ver perfil completo
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true"><path stroke-linecap="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Eventos: descripción toggle (solo móvil)
  grid.querySelectorAll('.desc-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`desc-${btn.dataset.id}`);
      const open  = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      btn.querySelector('span').textContent = open ? 'Ver descripción' : 'Ocultar descripción';
      btn.querySelector('.chevron').style.transform = open ? '' : 'rotate(180deg)';
      panel.classList.toggle('desc-open', !open);
    });
  });


  // Eventos: abrir modal de detalle
  grid.querySelectorAll('.pd-open-btn, .btn-ver-detalle').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openPdModal(parseInt(btn.dataset.id)); });
  });

  // Eventos: agregar al carrito
  grid.querySelectorAll('.size-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = parseInt(btn.dataset.id);
      const product = _allProducts?.find(p => p.id === pid) ?? Products.getById(pid);
      if (!product) return;
      Cart.add(product, btn.dataset.size, parseFloat(btn.dataset.price));
      btn.classList.add('added', 'selected');
      setTimeout(() => btn.classList.remove('added'), 700);
    });
  });

  renderPagination(Pagination.currentPage, totalPages);

}

// ─── Poblar filtro de familias olfativas ──────────────────────────────────────

function populateOlfFamilyFilter() {
  const sel = document.getElementById('olfFamilyFilter');
  if (!sel) return;
  const families = [...new Set((_allProducts || Products.getAll()).map(p => p.olfFamily).filter(Boolean))].sort();
  sel.innerHTML = '<option value="all">Todas las familias</option>' +
    families.map(f => `<option value="${escapeAttr(f)}">${f}</option>`).join('');
}

function resetAllFilters() {
  Filter.reset();
  Pagination.reset();
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
  document.querySelectorAll('.filter-group-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-group-btn[data-value="all"]').forEach(b => b.classList.add('active'));
  const olf = document.getElementById('olfFamilyFilter');
  if (olf) olf.value = 'all';
  const search = document.getElementById('searchInput');
  if (search) search.value = '';
  renderProducts();
}

// ─── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  _allProducts = await CloudProducts.getAll();
  document.dispatchEvent(new CustomEvent('catalogLoaded', { detail: _allProducts }));
  populateOlfFamilyFilter();
  renderProducts();
  Cart.render();

  // ── Filtro de tipo (Todos / Árabe / Diseñador) ─────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Filter.type = btn.dataset.filter;
      Pagination.reset();
      renderProducts();
    });
  });

  // ── Filtros de grupo (género, ocasión) ────────────────────────────────────
  document.querySelectorAll('.filter-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      document.querySelectorAll(`.filter-group-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Filter[group] = btn.dataset.value;
      Pagination.reset();
      renderProducts();
    });
  });

  // ── Familia olfativa ──────────────────────────────────────────────────────
  const olfSel = document.getElementById('olfFamilyFilter');
  if (olfSel) {
    olfSel.addEventListener('change', () => {
      Filter.olfFamily = olfSel.value;
      Pagination.reset();
      renderProducts();
    });
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  let searchTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      Filter.search = searchInput.value.trim().slice(0, 100);
      Pagination.reset();
      renderProducts();
    }, 300);
  });

  // ── Limpiar filtros ───────────────────────────────────────────────────────
  document.getElementById('clearFilters')?.addEventListener('click', resetAllFilters);

  // ── Carrito ───────────────────────────────────────────────────────────────
  document.getElementById('cartBtn')?.addEventListener('click', Cart.showCart.bind(Cart));
  document.getElementById('closeCart')?.addEventListener('click', Cart.hideCart.bind(Cart));
  document.getElementById('clearCartBtn')?.addEventListener('click', () => Cart.clear());
  document.getElementById('overlay')?.addEventListener('click', () => {
    Cart.hideCart();
    document.getElementById('checkoutModal')?.classList.remove('open');
  });
  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (!Cart.items.length) return;
    Cart.hideCart();
    Checkout.open();
  });
});

// ─── Modal de detalle de producto (v2) ────────────────────────────────────────

let _pdProduct  = null;
let _pdSelSize  = null;
let _pdSelPrice = 0;

function _pdEscHandler(e) { if (e.key === 'Escape') closePdModal(); }

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

  el.querySelector('.pd-close').addEventListener('click', closePdModal);
  document.addEventListener('keydown', _pdEscHandler);

  // Guía de decants: toggle tooltip
  document.getElementById('pdGuideBtn').addEventListener('click', e => {
    e.stopPropagation();
    const tt = document.getElementById('pdGuideTooltip');
    tt.style.display = tt.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('pdCartBtn').addEventListener('click', () => {
    // Si está en modo WhatsApp, el onclick del botón ya lo maneja
    if (!_pdProduct || !_pdSelSize) return;
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

function openPdModal(productId) {
  _createPdModal();
  const p = _allProducts?.find(x => x.id === productId) ?? Products.getById(productId);
  if (!p) return;
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
    const sizes = Object.values(p.sizes);
    const minPrice = sizes.length ? Math.min(...sizes) : 0;
    priceRow.innerHTML = minPrice > 0
      ? `<span class="pd-price-from">Desde</span> <strong class="pd-price-main">S/ ${minPrice}</strong>`
      : `<span class="pd-price-consultar">Consultar precio</span>`;
    priceRow.style.display = 'flex';
  } else {
    // Entero: mostrar precio si admin lo configuró, si no → consultar WA
    const enteroPrice = p.enteroPrice || 0;
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
  }

  // ── Botones de tamaño ────────────────────────────────────
  const sizesRow = document.getElementById('pdSizesRow');
  const cartBtn  = document.getElementById('pdCartBtn');
  const cartTxt  = document.getElementById('pdCartBtnText');
  cartBtn.classList.remove('added');

  if (isEntero) {
    const price = p.enteroPrice || 0;
    cartBtn.classList.remove('pd-cart-wa');
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
    cartBtn.disabled = true;
    cartTxt.textContent = 'Selecciona un tamaño';
    sizesRow.innerHTML = Object.entries(p.sizes).map(([ml, price]) => `
      <button class="pd-size-btn-new ${!p.inStock ? 'pd-size-disabled' : ''}"
              data-size="${escapeAttr(ml)}" data-price="${price}"
              ${!p.inStock ? 'disabled' : ''}>
        ${sanitize(ml)}
      </button>`).join('');

    sizesRow.querySelectorAll('.pd-size-btn-new:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        sizesRow.querySelectorAll('.pd-size-btn-new').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _pdSelSize  = btn.dataset.size;
        _pdSelPrice = parseFloat(btn.dataset.price);
        cartBtn.disabled = false;
        cartTxt.textContent = `AÑADIR AL CARRITO — S/ ${_pdSelPrice}`;
        cartBtn.classList.remove('added');
      });
    });
  }

  // ── Descripción ──────────────────────────────────────────
  document.getElementById('pdDesc').textContent = p.description || '';

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
    .filter(x => x.id !== p.id && x.inStock !== false)
    .sort((a, b) => {
      const aScore = (a.olfFamily === p.olfFamily ? 2 : 0) + (a.type === p.type ? 1 : 0);
      const bScore = (b.olfFamily === p.olfFamily ? 2 : 0) + (b.type === p.type ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 8);

  document.getElementById('pdDiscoverScroll').innerHTML = similar.map(sp => {
    const spMin = sp.type === 'entero' ? (sp.enteroPrice || 0)
      : (Object.values(sp.sizes).length ? Math.min(...Object.values(sp.sizes)) : 0);
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
  ['#carouselWrapper', '.filters-section', '#catalogBanner', '.products-section',
   '.marquee-strip', '.parallax-divider', '#contacto'].forEach(sel => {
    document.querySelector(sel)?.classList.add('pd-page-hidden');
  });

  const modal = document.getElementById('pdModal');
  modal.classList.add('open');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closePdModal() {
  document.getElementById('pdModal')?.classList.remove('open');
  // Restaurar secciones del catálogo
  document.querySelectorAll('.pd-page-hidden').forEach(el => el.classList.remove('pd-page-hidden'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}
