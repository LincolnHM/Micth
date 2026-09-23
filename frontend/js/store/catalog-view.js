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
  onlyFavorites: false,

  reset() { this.type = this.gender = this.occasion = this.olfFamily = 'all'; this.search = ''; this.onlyFavorites = false; },

  apply(products) {
    return products.filter(p => {
      if (this.onlyFavorites && !Wishlist.has(p.id)) return false;
      if (this.type === 'entero') {
        if (p.type !== 'entero' && !((p.enteroStock || 0) > 0)) return false;
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
           this.occasion !== 'all' || this.olfFamily !== 'all' || this.search || this.onlyFavorites;
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
        const filtersEl  = document.getElementById('catalogo');
        const bannerEl   = document.getElementById('catalogBanner');
        const productsEl = document.getElementById('productsGrid');
        // Scroll al primer elemento visible debajo de los filtros sticky
        const anchor = (bannerEl && bannerEl.offsetHeight > 0) ? bannerEl : productsEl;
        if (anchor) {
          const headerH  = 64;
          const filtersH = filtersEl ? filtersEl.offsetHeight : 0;
          window.scrollTo({ top: Math.max(0, anchor.offsetTop - headerH - filtersH), behavior: 'smooth' });
        }
      }, 90);
    });
  });
}

// ─── Render del catálogo ──────────────────────────────────────────────────────

let _allProducts = null;

function renderProducts() {
  const grid        = document.getElementById('productsGrid');
  const allFiltered = Filter.apply(_allProducts || Products.getAll());

  // Ordenar: si hay búsqueda, priorizar por relevancia; siempre agotados al fondo
  if (Filter.search) {
    const q = Filter.search.toLowerCase();
    const score = p => {
      const name  = (p.name  || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      if (name === q)                  return 6;
      if (name.startsWith(q))          return 5;
      if (brand === q)                 return 4;
      if (name.includes(q))            return 3;
      if (brand.includes(q))           return 2;
      return 1; // fuzzy match
    };
    allFiltered.sort((a, b) => {
      const aPurch = isDecantPurchasable(a) && (a.type !== 'entero' || a.inStock);
      const bPurch = isDecantPurchasable(b) && (b.type !== 'entero' || b.inStock);
      if (aPurch !== bPurch) return aPurch ? -1 : 1;
      return score(b) - score(a);
    });
  } else {
    // Sin búsqueda: agotados al fondo, resto en orden original
    allFiltered.sort((a, b) => {
      const aPurch = isDecantPurchasable(a) && (a.type !== 'entero' || a.inStock);
      const bPurch = isDecantPurchasable(b) && (b.type !== 'entero' || b.inStock);
      return aPurch === bPurch ? 0 : aPurch ? -1 : 1;
    });
  }
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
    const hasSearch = !!Filter.search;
    const onlyFavEmpty = Filter.onlyFavorites && !hasSearch;
    grid.innerHTML = `
      <div class="no-results">
        <div style="font-size:2.5rem;margin-bottom:.75rem">${hasSearch ? '🔍' : onlyFavEmpty ? '🤍' : '✨'}</div>
        <p>${hasSearch
          ? `No encontramos ningún perfume para <strong style="color:var(--gold)">"${Filter.search}"</strong>.`
          : onlyFavEmpty
            ? 'Aún no guardaste ningún favorito. Toca el corazón ♡ en un perfume para guardarlo aquí.'
            : 'No se encontraron fragancias con esos filtros.'}</p>
        <button onclick="resetAllFilters()" class="btn-reset-filter">Limpiar filtros</button>
      </div>`;
    renderPagination(0, 0);
    return;
  }

  grid.innerHTML = products.map(p => {
    const showAsEntero = Filter.type === 'entero' && (p.enteroStock || 0) > 0 && p.type !== 'entero';
    const isEntero     = p.type === 'entero' || showAsEntero;
    const sizeValues   = showAsEntero ? [p.enteroPrice || 0] : Object.values(p.sizes || {});
    const positiveSizeValues = sizeValues.filter(v => v > 0);
    const minPrice     = positiveSizeValues.length ? Math.min(...positiveSizeValues) : 0;
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
          const inCart    = Cart.items.some(i => i.productId === p.id && i.size === ml);
          const noMl      = !bottleHasMl(p, ml);
          const disabledSize = !p.inStock || price === 0 || noMl;
          const priceDisplay = price > 0 ? `S/${price}` : 'Consultar';
          return `
      <button class="size-btn ${disabledSize ? 'disabled' : ''} ${inCart ? 'selected' : ''}"
              data-id="${p.id}" data-size="${escapeAttr(ml)}" data-price="${price}"
              ${disabledSize ? 'disabled aria-disabled="true"' : ''}>
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

    // Badge NUEVO: si fue agregado en los últimos 30 días
    const isNew = p.date && (Date.now() - new Date(p.date).getTime()) < 30 * 24 * 3600 * 1000;
    // Calcular estado real de disponibilidad (considera ml restante)
    const purchasable = isEntero ? p.inStock : isDecantPurchasable(p);
    // Stock restante: mostrar si queda poco (solo si todavía hay algo disponible)
    const lowMlWarn = !isEntero && p.bottleTotalMl > 0 && p.bottleRemainingMl > 0 && purchasable && p.bottleRemainingMl < 15
      ? `<div class="stock-low-tag">~${Math.round(p.bottleRemainingMl)}ml restantes</div>` : '';
    // Wishlist
    const isFav = Wishlist.has(p.id);

    return `
      <article class="product-card ${!purchasable ? 'out-of-stock' : ''} ${p.featured ? 'featured' : ''}">
        <div class="card-glow-overlay"></div>
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
            ${isNew ? '<span class="badge-new">NUEVO</span>' : ''}
          </div>
          ${!purchasable ? '<div class="out-badge">Agotado</div>' : ((p.type === 'entero' && p.stockQuantity === 1) || (showAsEntero && p.enteroStock === 1) ? '<div class="last-unit-badge">⚠ Última unidad</div>' : '')}
          ${lowMlWarn}
          ${p.olfFamily ? `<div class="olf-family-tag">${sanitize(p.olfFamily)}</div>` : ''}
          <button class="pd-open-btn" data-id="${p.id}" aria-label="Ver detalles de ${sanitize(p.name)}">Ver detalles →</button>
          <!-- Acciones flotantes -->
          <div class="card-float-actions">
            <button class="card-action-btn wishlist-btn ${isFav ? 'active' : ''}" data-id="${p.id}" aria-label="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" title="${isFav ? 'Quitar favorito' : 'Guardar favorito'}">
              <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            </button>
            <button class="card-action-btn share-btn" data-id="${p.id}" data-name="${escapeAttr(p.brand + ' ' + p.name)}" aria-label="Compartir" title="Compartir perfume">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
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

  // Eventos: wishlist
  grid.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pid = parseInt(btn.dataset.id);
      const active = Wishlist.toggle(pid);
      btn.classList.toggle('active', active);
      btn.querySelector('svg').setAttribute('fill', active ? 'currentColor' : 'none');
      btn.setAttribute('aria-label', active ? 'Quitar de favoritos' : 'Agregar a favoritos');
      showCartToast(active ? '❤ Guardado en favoritos' : 'Quitado de favoritos');
      updateFavFilterBadge();
      // Si se está viendo "solo favoritos" y se quitó uno, sacarlo de la vista
      if (Filter.onlyFavorites && !active) renderProducts();
    });
  });

  // Eventos: compartir
  grid.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      shareProduct(parseInt(btn.dataset.id), btn.dataset.name);
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

// ─── Wishlist / Favoritos ─────────────────────────────────────────────────────

const Wishlist = {
  _key: 'micht_wishlist',
  _ids: null,

  _load() {
    if (this._ids) return;
    try { this._ids = new Set(JSON.parse(localStorage.getItem(this._key) || '[]')); }
    catch { this._ids = new Set(); }
  },
  _save() {
    try { localStorage.setItem(this._key, JSON.stringify([...this._ids])); } catch {}
  },

  has(id)     { this._load(); return this._ids.has(id); },
  toggle(id)  { this._load(); this._ids.has(id) ? this._ids.delete(id) : this._ids.add(id); this._save(); return this._ids.has(id); },
  getAll()    { this._load(); return [...this._ids]; },
  count()     { this._load(); return this._ids.size; }
};

// Sincroniza el contador del botón "Favoritos" de la barra de filtros
function updateFavFilterBadge() {
  const badge = document.getElementById('favFilterCount');
  if (!badge) return;
  const n = Wishlist.count();
  badge.textContent = n;
  badge.style.display = n > 0 ? 'inline-block' : 'none';
}

// ─── Compartir perfume ────────────────────────────────────────────────────────

function shareProduct(id, name) {
  const url = `${location.origin}${location.pathname}?p=${id}`;
  if (navigator.share) {
    navigator.share({ title: name, text: `Mira este perfume en MICHT Decants: ${name}`, url })
      .catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => showCartToast('🔗 Link copiado al portapapeles'))
      .catch(() => {
        const ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showCartToast('🔗 Link copiado al portapapeles');
      });
  }
}

// Manejar link de compartir al cargar la página (?p=ID)
(function handleShareLink() {
  const params = new URLSearchParams(location.search);
  const pid    = parseInt(params.get('p'));
  if (!pid || isNaN(pid)) return;
  // Esperar a que los productos carguen
  const tryOpen = setInterval(() => {
    if (typeof openPdModal === 'function' && (_allProducts || Products.getAll()).length > 0) {
      clearInterval(tryOpen);
      openPdModal(pid);
      // Limpiar el parámetro de la URL sin recargar
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]p=\d+/, '').replace(/^&/, '?'));
    }
  }, 200);
  setTimeout(() => clearInterval(tryOpen), 6000);
})();

function resetAllFilters() {
  Filter.reset();
  Pagination.reset();
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
  document.querySelectorAll('.filter-group-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-group-btn[data-value="all"]').forEach(b => b.classList.add('active'));
  const favBtn = document.getElementById('favFilterBtn');
  if (favBtn) { favBtn.classList.remove('active'); favBtn.setAttribute('aria-pressed', 'false'); }
  const olf = document.getElementById('olfFamilyFilter');
  if (olf) olf.value = 'all';
  const search = document.getElementById('searchInput');
  if (search) search.value = '';
  const box = document.getElementById('srch-suggestions');
  if (box) { box.innerHTML = ''; box.classList.remove('open'); }
  renderProducts();
}
