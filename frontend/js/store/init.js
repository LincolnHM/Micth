// ─── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  Cart.load();
  // Pedidos que no llegaron a la base (ej.: en el celular la página pasó al fondo al abrir
  // WhatsApp antes de terminar el envío) se reenvían solos en la siguiente visita.
  setTimeout(() => { try { CloudOrders.retryPending(); } catch (_) {} }, 3000);
  try {
    _allProducts = await Promise.race([
      CloudProducts.getAll(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
    ]);
  } catch (_) {
    // Red lenta o caída — mostrar el catálogo local para que la tienda siga siendo usable
    _allProducts = Products.getAll();
  }
  document.dispatchEvent(new CustomEvent('catalogLoaded', { detail: _allProducts }));
  populateOlfFamilyFilter();
  renderProducts();
  renderCombos().catch(err => console.error('[MICHT] Error cargando combos:', err));
  initCombosCarousel();
  Cart.render();
  updateFavFilterBadge();

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

  // ── Toggle "solo favoritos" ────────────────────────────────────────────────
  document.getElementById('favFilterBtn')?.addEventListener('click', function () {
    Filter.onlyFavorites = !Filter.onlyFavorites;
    this.classList.toggle('active', Filter.onlyFavorites);
    this.setAttribute('aria-pressed', String(Filter.onlyFavorites));
    Pagination.reset();
    renderProducts();
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

  // ── Búsqueda con autocomplete ────────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  let searchTimer;

  function _srchHighlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) +
      `<mark class="srch-sug-hl">${text.slice(idx, idx + query.length)}</mark>` +
      text.slice(idx + query.length);
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
    const matches = all.filter(p => {
      const n = (p.name || '').toLowerCase();
      const b = (p.brand || '').toLowerCase();
      return n.includes(qLow) || b.includes(qLow) || fuzzyMatch(query, p.name);
    }).slice(0, 7);

    if (!matches.length) {
      box.innerHTML = `<div class="srch-sug-item no-results" role="option">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        Perfume no encontrado
      </div>`;
    } else {
      box.innerHTML = matches.map(p => `
        <div class="srch-sug-item" role="option" data-name="${p.name.replace(/"/g, '&quot;')}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.45;flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span class="srch-sug-name">${_srchHighlight(p.name, query)}</span>
          <span class="srch-sug-brand">${p.brand}</span>
        </div>`).join('');
      box.querySelectorAll('.srch-sug-item[data-name]').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          searchInput.value = item.dataset.name;
          Filter.search = item.dataset.name;
          Pagination.reset();
          renderProducts();
          box.innerHTML = ''; box.classList.remove('open');
        });
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
    const items = [...box.querySelectorAll('.srch-sug-item[data-name]')];
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
    const stockErrors = validateCartStock();
    if (stockErrors.length) { showStockAlert(stockErrors); return; }
    Cart.hideCart();
    Checkout.open();
  });
});
