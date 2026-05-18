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
    const sizeValues   = showAsEntero ? [p.enteroPrice || 0] : Object.values(p.sizes);
    const minPrice     = sizeValues.length ? Math.min(...sizeValues) : 0;
    const genderIcon  = { hombre: '♂', mujer: '♀', unisex: '⚥' }[p.gender] || '';
    const occasionLbl = { dia: 'Día', noche: 'Noche', ambas: 'Día & Noche' }[p.occasion] || '';
    const typeLabel   = showAsEntero ? 'Entero' : (p.type === 'arabe' ? 'Árabe' : isEntero ? 'Entero' : 'Diseñador');
    const typeBadge   = showAsEntero ? 'badge-entero' : (p.type === 'arabe' ? 'badge-arabe' : isEntero ? 'badge-entero' : 'badge-dis');

    const notesHtml = (!isEntero && (p.topNotes || p.heartNotes || p.baseNotes)) ? `
      <div class="notes-pyramid" id="notes-${p.id}" style="display:none">
        ${p.topNotes    ? `<div class="note-tier"><span class="note-label">Salida</span><span class="note-val">${sanitize(p.topNotes)}</span></div>` : ''}
        ${p.heartNotes  ? `<div class="note-tier"><span class="note-label">Corazón</span><span class="note-val">${sanitize(p.heartNotes)}</span></div>` : ''}
        ${p.baseNotes   ? `<div class="note-tier"><span class="note-label">Fondo</span><span class="note-val">${sanitize(p.baseNotes)}</span></div>` : ''}
      </div>` : '';

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

          ${notesHtml ? `
          <button class="notes-toggle" data-id="${p.id}" aria-expanded="false">
            <span>Ver notas olfativas</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron" aria-hidden="true">
              <path stroke-linecap="round" d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          ${notesHtml}` : ''}

          <div class="product-footer">
            ${priceHtml}
            <div class="sizes-row">${sizesHtml}</div>
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

  // Eventos: notas olfativas toggle
  grid.querySelectorAll('.notes-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`notes-${btn.dataset.id}`);
      const open  = panel.style.display === 'block';
      panel.style.display  = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
      btn.querySelector('span').textContent = open ? 'Ver notas olfativas' : 'Ocultar notas';
      btn.querySelector('.chevron').style.transform = open ? '' : 'rotate(180deg)';
    });
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
