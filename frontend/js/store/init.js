// ─── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  Cart.load();
  // Pedidos que no llegaron a la base (ej.: en el celular la página pasó al fondo al abrir
  // WhatsApp antes de terminar el envío) se reenvían solos en la siguiente visita.
  setTimeout(() => { try { CloudOrders.retryPending(); } catch (_) {} }, 3000);
  // Los combos se piden al mismo tiempo que el catálogo (antes, recién después):
  // si llegaban tarde aparecían encima y empujaban el catálogo hacia abajo
  const combosRequest = (typeof CloudCombos !== 'undefined') ? CloudCombos.getAll().catch(() => null) : null;
  try {
    _allProducts = await Promise.race([
      CloudProducts.getAll(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
    ]);
  } catch (_) {
    // Red lenta o caída — mostrar el catálogo local para que la tienda siga siendo usable
    _allProducts = Products.getAll();
  }
  // Los que aún no llegan van solo a "Próximamente" (coming-soon.js): fuera del
  // catálogo, la búsqueda, el Scent Finder y las páginas de cada perfume
  _comingSoonProducts = _allProducts.filter(isComingSoon);
  _allProducts = _allProducts.filter(p => !isComingSoon(p));
  document.dispatchEvent(new CustomEvent('catalogLoaded', { detail: _allProducts }));
  // Filtros (tipos, panel, URL): los prepara filters-ui.js al recibir 'catalogLoaded'
  renderProducts();
  renderComingSoon();
  renderRecentlyViewed();
  renderCombos(combosRequest).catch(err => console.error('[MICHT] Error cargando combos:', err));
  initCombosCarousel();
  Cart.render();
  updateFavFilterBadge();

  // ── Vistos recientemente: borrar ──────────────────────────────────────────
  document.getElementById('recentClearBtn')?.addEventListener('click', () => {
    RecentlyViewed.clear();
    renderRecentlyViewed();
  });

  // ── Búsqueda con autocomplete ────────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  let searchTimer;

  // Escapa HTML sin recortar espacios (sanitize() hace trim y pegaría
  // "Sauvage" + " Elixir" al resaltar)
  const _esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function _srchHighlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return _esc(text);
    return _esc(text.slice(0, idx)) +
      `<mark class="srch-sug-hl">${_esc(text.slice(idx, idx + query.length))}</mark>` +
      _esc(text.slice(idx + query.length));
  }

  function _closeSuggestions() {
    const box = document.getElementById('srch-suggestions');
    if (box) { box.innerHTML = ''; box.classList.remove('open'); }
  }

  function _positionSugBox() {
    const box = document.getElementById('srch-suggestions');
    const input = document.getElementById('searchInput');
    if (!box || !input) return;
    const r = input.getBoundingClientRect();
    box.style.top    = (r.bottom + 6) + 'px';
    box.style.left   = r.left + 'px';
    box.style.width  = r.width + 'px';
  }

  function renderSuggestions(query) {
    const box = document.getElementById('srch-suggestions');
    if (!box) return;
    if (!query) { box.innerHTML = ''; box.classList.remove('open'); return; }

    const all = _allProducts || Products.getAll();
    const qLow = query.toLowerCase();
    // Coincide por nombre/marca o por el perfume famoso al que se parece
    // ("sauvage" → Dior Sauvage y también los árabes que se le parecen)
    const rank = p => {
      const n = (p.name || '').toLowerCase();
      const b = (p.brand || '').toLowerCase();
      const d = (p.dupeOf?.name || '').toLowerCase();
      if (n.startsWith(qLow)) return 5;
      if (n.includes(qLow))   return 4;
      if (b.includes(qLow))   return 3;
      if (d.includes(qLow))   return 2;
      if (fuzzyMatch(query, p.name) || (p.dupeOf?.name && fuzzyMatch(query, p.dupeOf.name))) return 1;
      return 0;
    };
    const matches = all.map(p => ({ p, r: rank(p) })).filter(m => m.r > 0)
      .sort((a, b) => (productIsPurchasable(b.p) - productIsPurchasable(a.p)) || (b.r - a.r))
      .slice(0, 6).map(m => m.p);

    if (!matches.length) {
      box.innerHTML = `<div class="srch-sug-item no-results" role="option">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        Perfume no encontrado
      </div>`;
    } else {
      box.innerHTML = matches.map(p => {
        const min  = productMinPrice(p);
        const viaDupe = !(p.name || '').toLowerCase().includes(qLow) && !(p.brand || '').toLowerCase().includes(qLow) && p.dupeOf?.name;
        const sub  = viaDupe
          ? `Se parece a ${_srchHighlight(p.dupeOf.name, query)}`
          : `${sanitize(p.brand)}${min > 0 ? ` · ${p.type === 'entero' ? '' : 'desde '}S/ ${min}` : ''}`;
        const img  = p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '';
        return `
        <div class="srch-sug-item srch-sug-product" role="option" data-id="${p.id}">
          <span class="srch-sug-thumb">${img}</span>
          <span class="srch-sug-text">
            <span class="srch-sug-name">${_srchHighlight(p.name, query)}</span>
            <span class="srch-sug-sub">${sub}</span>
          </span>
          ${productIsPurchasable(p) ? '' : '<span class="srch-sug-out">Agotado</span>'}
        </div>`;
      }).join('') + `
        <div class="srch-sug-item srch-sug-all" role="option" data-all="1">Ver todos los resultados →</div>`;

      box.querySelectorAll('.srch-sug-item[data-id]').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          _closeSuggestions();
          searchInput.blur();
          openPdModal(parseInt(item.dataset.id));
        });
      });
      box.querySelector('.srch-sug-all')?.addEventListener('mousedown', e => {
        e.preventDefault();
        clearTimeout(searchTimer);
        Filter.search = searchInput.value.trim().slice(0, 100);
        Pagination.reset();
        renderProducts();
        _closeSuggestions();
        searchInput.blur();
        const grid = document.getElementById('productsGrid');
        const filtersH = document.getElementById('catalogo')?.offsetHeight || 0;
        if (grid) window.scrollTo({ top: Math.max(0, grid.offsetTop - 64 - filtersH), behavior: 'smooth' });
      });
    }
    _positionSugBox();
    box.classList.add('open');
  }

  window.addEventListener('resize', () => {
    const box = document.getElementById('srch-suggestions');
    if (box && box.classList.contains('open')) _positionSugBox();
  });

  const searchClearBtn = document.getElementById('searchClearBtn');

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().slice(0, 100);
    if (searchClearBtn) searchClearBtn.style.display = query ? 'flex' : 'none';
    renderSuggestions(query);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      Filter.search = query;
      Pagination.reset();
      renderProducts();
    }, 250);
  });

  searchClearBtn?.addEventListener('click', () => {
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    searchClearBtn.style.display = 'none';
    Filter.search = '';
    Pagination.reset();
    renderProducts();
    const box = document.getElementById('srch-suggestions');
    if (box) { box.innerHTML = ''; box.classList.remove('open'); }
  });

  searchInput?.addEventListener('blur', () => {
    setTimeout(() => {
      const box = document.getElementById('srch-suggestions');
      if (box) { box.innerHTML = ''; box.classList.remove('open'); }
    }, 180);
  });

  searchInput?.addEventListener('keydown', e => {
    const box = document.getElementById('srch-suggestions');
    if (!box || !box.classList.contains('open')) return;
    const items = [...box.querySelectorAll('.srch-sug-item[data-id], .srch-sug-item[data-all]')];
    const cur = box.querySelector('.srch-sug-item.focused');
    const idx = cur ? items.indexOf(cur) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cur?.classList.remove('focused');
      items[Math.min(idx + 1, items.length - 1)]?.classList.add('focused');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cur?.classList.remove('focused');
      items[Math.max(idx - 1, 0)]?.classList.add('focused');
    } else if (e.key === 'Enter' && cur) {
      e.preventDefault();
      cur.dispatchEvent(new MouseEvent('mousedown'));
    } else if (e.key === 'Escape') {
      box.innerHTML = ''; box.classList.remove('open');
    }
  });


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
    const stockErrors = validateCartStock();
    if (stockErrors.length) { showStockAlert(stockErrors); return; }
    Cart.hideCart();
    Checkout.open();
  });
});
