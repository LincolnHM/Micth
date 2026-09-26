// ─── Barra de búsqueda y filtros del catálogo ─────────────────────────────────
//
// Arriba del catálogo (fija al bajar): buscador siempre visible, tipos como chips
// y el botón "Filtros", que abre un panel (hoja desde abajo en el celular,
// lateral en PC) con: para quién, momento del día, aroma, orden y favoritos.
// Debajo, los filtros aplicados como chips que se quitan con ×.
//
// El estado vive en `Filter` y `Sort` (catalog-view.js). renderProducts() llama a
// syncFilterUI() para que botones, conteos y la dirección queden al día.
//
// La dirección guarda los filtros (?tipo=arabe&para=hombre&aroma=dulce…): se
// pueden compartir y sobreviven a una recarga.

const _URL_KEYS = { tipo: 'type', para: 'gender', momento: 'occasion', aroma: 'aroma' };
const _GENDER_LBL = { hombre: 'Hombre', mujer: 'Mujer', unisex: 'Solo unisex' };
const _OCC_LBL    = { dia: 'Día', noche: 'Noche' };
const _TYPES_OK   = ['all', 'arabe', 'diseñador', 'nicho', 'entero'];
const _SORTS_OK   = ['relevance', 'price-asc', 'price-desc', 'new', 'popular'];

// ─── Leer los filtros de la dirección (al cargar) ────────────────────────────
function _filtersFromUrl() {
  const q = new URLSearchParams(location.search);
  const pick = (v, ok) => ok.includes(v) ? v : 'all';
  if (q.has('tipo'))    Filter.type     = pick(q.get('tipo'), _TYPES_OK);
  if (q.has('para'))    Filter.gender   = pick(q.get('para'), ['all', 'hombre', 'mujer', 'unisex']);
  if (q.has('momento')) Filter.occasion = pick(q.get('momento'), ['all', 'dia', 'noche']);
  if (q.has('aroma'))   Filter.aroma    = pick(q.get('aroma'), ['all', ...AROMAS.map(a => a.key)]);
  if (q.get('fav') === '1') Filter.onlyFavorites = true;
  if (q.has('orden') && _SORTS_OK.includes(q.get('orden'))) Sort.mode = q.get('orden');
  const text = (q.get('q') || '').trim().slice(0, 100);
  if (text) {
    Filter.search = text;
    const input = document.getElementById('searchInput');
    if (input) input.value = text;
    const clear = document.getElementById('searchClearBtn');
    if (clear) clear.style.display = 'flex';
  }
}

// ─── Escribir los filtros en la dirección (sin crear historial) ─────────────
function _filtersToUrl() {
  // Solo en el catálogo: con una ficha abierta la dirección es la del perfume
  if (location.pathname !== '/' || document.querySelector('.pd-modal.open')) return;
  const q = new URLSearchParams(location.search);
  Object.keys(_URL_KEYS).forEach(k => q.delete(k));
  ['q', 'fav', 'orden'].forEach(k => q.delete(k));
  Object.entries(_URL_KEYS).forEach(([k, f]) => { if (Filter[f] !== 'all') q.set(k, Filter[f]); });
  if (Filter.onlyFavorites) q.set('fav', '1');
  if (Sort.mode !== 'relevance') q.set('orden', Sort.mode);
  if (Filter.search) q.set('q', Filter.search);
  const qs = q.toString();
  const url = '/' + (qs ? '?' + qs : '');
  if (url !== location.pathname + location.search) {
    try { history.replaceState(history.state, '', url); history.scrollRestoration = 'manual'; } catch (_) {}
  }
}

// ─── Chips de aroma (se arman con el catálogo cargado) ──────────────────────
function _renderAromaChips() {
  const box = document.getElementById('aromaChips');
  if (!box) return;
  box.innerHTML = AROMAS.map(a => `
    <button type="button" class="filter-group-btn" data-group="aroma" data-value="${a.key}">
      <span aria-hidden="true">${a.icon}</span> ${a.label} <span class="fs-count"></span>
    </button>`).join('');
}

// ─── Poner la interfaz al día con el estado de los filtros ──────────────────
function syncFilterUI(resultCount) {
  const all = _allProducts || Products.getAll();

  // Tipos
  document.querySelectorAll('.ct-types .filter-btn').forEach(b => {
    const on = b.dataset.filter === Filter.type;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });

  // Chips del panel + cuántos perfumes quedarían al elegir cada opción
  const facetCount = (group, value, base) => {
    if (value === 'all') return base.length;
    if (group === 'gender')   return base.filter(p => value === 'unisex' ? p.gender === 'unisex' : (p.gender === value || p.gender === 'unisex')).length;
    if (group === 'occasion') return base.filter(p => p.occasion === value || p.occasion === 'ambas').length;
    if (group === 'aroma')    return base.filter(p => productAromas(p).has(value)).length;
    return 0;
  };
  const bases = {};
  document.querySelectorAll('#filterSheet .filter-group-btn').forEach(b => {
    const g = b.dataset.group, v = b.dataset.value;
    b.classList.toggle('active', Filter[g] === v);
    b.setAttribute('aria-pressed', String(Filter[g] === v));
    const countEl = b.querySelector('.fs-count');
    if (countEl) {
      bases[g] = bases[g] || Filter.apply(all, g);
      const n = facetCount(g, v, bases[g]);
      countEl.textContent = n;
      b.disabled = n === 0 && Filter[g] !== v;
    }
  });

  // Orden
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) sortSel.value = Sort.mode;
  document.querySelectorAll('.fs-sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === Sort.mode));

  // Favoritos
  const fav = document.getElementById('favFilterBtn');
  if (fav) { fav.classList.toggle('active', Filter.onlyFavorites); fav.setAttribute('aria-pressed', String(Filter.onlyFavorites)); }

  // Número del botón "Filtros"
  const n = Filter.panelCount();
  const badge = document.getElementById('filtersActiveBadge');
  if (badge) { badge.textContent = n; badge.hidden = n === 0; }

  // Filtros aplicados (cada uno se quita con ×)
  const chips = [];
  if (Filter.search)            chips.push(['search', `“${Filter.search}”`]);
  if (Filter.gender !== 'all')   chips.push(['gender', _GENDER_LBL[Filter.gender]]);
  if (Filter.occasion !== 'all') chips.push(['occasion', _OCC_LBL[Filter.occasion]]);
  if (Filter.aroma !== 'all')    chips.push(['aroma', AROMAS.find(a => a.key === Filter.aroma)?.label || Filter.aroma]);
  if (Filter.onlyFavorites)      chips.push(['fav', 'Favoritos']);
  const active = document.getElementById('activeFilters');
  if (active) {
    active.innerHTML = chips.map(([k, label]) =>
      `<button type="button" class="ct-chip" data-clear="${k}" aria-label="Quitar filtro ${escapeAttr(label)}">${sanitize(label)} <span aria-hidden="true">×</span></button>`).join('');
  }
  const clear = document.getElementById('clearFilters');
  if (clear) clear.hidden = !Filter.hasActiveFilters();
  document.querySelector('.catalog-toolbar')?.classList.toggle('has-active', chips.length > 0);

  // Botón del panel
  const apply = document.getElementById('sheetApplyBtn');
  if (apply && typeof resultCount === 'number') {
    const label = Filter.type === 'entero' ? 'producto' : 'perfume';
    apply.textContent = resultCount ? `Ver ${resultCount} ${label}${resultCount !== 1 ? 's' : ''}` : 'Sin resultados';
  }

  _filtersToUrl();
}

// ─── Panel de filtros ────────────────────────────────────────────────────────
let _sheetReturnFocus = null;

function openFilterSheet() {
  const sheet = document.getElementById('filterSheet');
  if (!sheet) return;
  _sheetReturnFocus = document.activeElement;
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => sheet.classList.add('open'));
  document.getElementById('filtersOpenBtn')?.setAttribute('aria-expanded', 'true');
  setTimeout(() => sheet.querySelector('.fs-close')?.focus(), 50);
}

function closeFilterSheet() {
  const sheet = document.getElementById('filterSheet');
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove('open');
  document.body.classList.remove('sheet-open');
  document.getElementById('filtersOpenBtn')?.setAttribute('aria-expanded', 'false');
  setTimeout(() => { sheet.hidden = true; }, 220);
  _sheetReturnFocus?.focus?.({ preventScroll: true });
}

// ─── Ir al catálogo (menú "Catálogo" y lupa del encabezado) ─────────────────
function scrollToCatalog({ focusSearch = false } = {}) {
  if (typeof closePdModal === 'function' && document.querySelector('.pd-modal.open')) closePdModal({ restoreScroll: false });
  const el = document.getElementById('catalogo');
  if (!el) return;
  const top = Math.max(0, el.offsetTop - 64);
  if (focusSearch) {
    // Salto directo + foco en el mismo toque: en el celular el foco corta un
    // desplazamiento suave a medias, y el iPhone solo abre el teclado si el foco
    // ocurre dentro del toque
    window.scrollTo({ top, behavior: 'instant' });
    document.getElementById('searchInput')?.focus({ preventScroll: true });
  } else {
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

function _applyAndRender() {
  Pagination.reset();
  renderProducts();
}

// ─── Eventos ─────────────────────────────────────────────────────────────────
document.addEventListener('catalogLoaded', () => {
  _renderAromaChips();
  // Sin perfumes "nicho" en la base el chip se oculta en vez de dar 0 resultados
  const nicho = document.querySelector('.ct-types .filter-btn[data-filter="nicho"]');
  if (nicho) nicho.hidden = !(_allProducts || []).some(p => p.type === 'nicho');
  _filtersFromUrl();
});

document.addEventListener('DOMContentLoaded', () => {
  // Tipos
  document.querySelectorAll('.ct-types .filter-btn').forEach(b => b.addEventListener('click', () => {
    Filter.type = b.dataset.filter;
    _applyAndRender();
  }));

  // Chips del panel (para quién, momento, aroma). Tocar la opción activa la quita.
  document.getElementById('filterSheet')?.addEventListener('click', e => {
    const chip = e.target.closest('.filter-group-btn');
    if (chip && !chip.disabled) {
      const g = chip.dataset.group, v = chip.dataset.value;
      Filter[g] = (Filter[g] === v && v !== 'all') ? 'all' : v;
      _applyAndRender();
      return;
    }
    const sortBtn = e.target.closest('.fs-sort-btn');
    if (sortBtn) { Sort.mode = sortBtn.dataset.sort; _applyAndRender(); return; }
    if (e.target.closest('[data-sheet-close]')) closeFilterSheet();
  });

  document.getElementById('sortSelect')?.addEventListener('change', function () {
    Sort.mode = this.value;
    _applyAndRender();
  });

  document.getElementById('favFilterBtn')?.addEventListener('click', () => {
    Filter.onlyFavorites = !Filter.onlyFavorites;
    _applyAndRender();
  });

  // Quitar un filtro aplicado
  document.getElementById('activeFilters')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-clear]');
    if (!chip) return;
    const k = chip.dataset.clear;
    if (k === 'search') {
      Filter.search = '';
      const input = document.getElementById('searchInput');
      if (input) input.value = '';
      const clear = document.getElementById('searchClearBtn');
      if (clear) clear.style.display = 'none';
    } else if (k === 'fav') {
      Filter.onlyFavorites = false;
    } else {
      Filter[k] = 'all';
    }
    _applyAndRender();
  });

  ['clearFilters', 'sheetClearBtn'].forEach(id => document.getElementById(id)?.addEventListener('click', resetAllFilters));

  document.getElementById('filtersOpenBtn')?.addEventListener('click', openFilterSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFilterSheet(); });

  document.getElementById('headerSearchBtn')?.addEventListener('click', () => scrollToCatalog({ focusSearch: true }));
});
