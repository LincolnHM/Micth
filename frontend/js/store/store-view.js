// ─── MICHT Decants · Pestañas Inicio / Catálogo ───────────────────────────────
// La tienda es una sola página con dos pestañas:
//   · Inicio   (/)           carrusel, combos, próximamente, accesos al catálogo,
//                            cómo comprar, galería y contacto
//   · Catálogo (/#catalogo)  buscador, filtros y todos los perfumes. Con filtros
//                            es /?tipo=arabe#catalogo (los links de antes, como
//                            /?tipo=arabe sin #catalogo, también lo abren)
// Lo de cada pestaña lleva la clase .view-inicio o .view-catalogo y el atributo
// data-view de <html> decide cuál se ve. La pestaña inicial la pone un script
// del <head> antes de pintar (para que no parpadee), con la misma regla que
// storeViewFromUrl(). Cambiar de pestaña es una entrada más del historial: el
// "atrás" del celular vuelve a la anterior, en el mismo lugar donde estaba.

// Parámetros que abren el Catálogo: los filtros (filters-ui.js), los links a un
// perfume (debajo de su ficha queda el catálogo) y la exportación a PDF
const _SV_CATALOG_KEYS = ['tipo', 'para', 'momento', 'aroma', 'orden', 'q', 'fav', 'p', 'perfume', 'export'];

function storeViewFromUrl() {
  if (location.hash === '#catalogo' || location.pathname.startsWith('/perfume/')) return 'catalogo';
  const q = new URLSearchParams(location.search);
  return _SV_CATALOG_KEYS.some(k => q.has(k)) ? 'catalogo' : 'inicio';
}

function currentStoreView() {
  return document.documentElement.dataset.view === 'catalogo' ? 'catalogo' : 'inicio';
}

// Muestra una pestaña (sin tocar el historial) y marca el link del menú
function applyStoreView(view) {
  const root = document.documentElement;
  const changed = root.dataset.view !== view;
  root.dataset.view = view;
  document.querySelectorAll('[data-nav-view]').forEach(a => {
    if (a.dataset.navView === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // Las animaciones al bajar (GSAP) miden posiciones que cambian con la pestaña
  if (changed && window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
}

function _svPush(view, y = window.scrollY) {
  try {
    // Dónde estaba el cliente en la pestaña que deja: "atrás" lo devuelve ahí
    history.replaceState({ ...(history.state || {}), y }, '');
    history.scrollRestoration = 'manual';
    history.pushState({ view }, '', view === 'catalogo' ? catalogUrl() : '/');
  } catch (_) {}
}

// Pestaña a la que se va mientras se cierra una ficha (se agrega al historial
// cuando el navegador termina de volver a la entrada de abajo, ver popstate)
let _svPending = null;

// Ir a una pestaña. `section`: id de una sección para bajar hasta ella (ej. combos).
// `instant`: sin desplazamiento suave (el foco en el buscador lo corta en el celular).
function goStoreView(view, { section = null, instant = false } = {}) {
  const from = currentStoreView();
  let jump = view !== from;
  if (typeof _anyDetailOpen === 'function' && _anyDetailOpen()) {
    // La ficha es una entrada del historial: al cerrarla el navegador vuelve
    // (history.go) a la de abajo, y recién ahí se puede agregar la nueva
    const willPop = _pdDepth > 0 && (Number.isInteger(history.state?.pd) || Number.isInteger(history.state?.combo));
    const y = _pdReturnY;
    closePdModal({ restoreScroll: false });
    if (view !== from) {
      if (willPop) _svPending = { view, y };
      else _svPush(view, y);
    }
    jump = true;
  } else if (view !== from) {
    _svPush(view);
  }
  applyStoreView(view);

  const el = section && document.getElementById(section);
  const behavior = jump || instant ? 'instant' : 'smooth';
  window.scrollTo({ top: el ? Math.max(0, el.offsetTop - 68) : 0, behavior });
}

window.addEventListener('popstate', e => {
  if (_svPending) {
    const { view, y } = _svPending;
    _svPending = null;
    _svPush(view, y);
    applyStoreView(view);
    return;
  }
  const st = e.state;
  if (st && (Number.isInteger(st.pd) || Number.isInteger(st.combo))) return;   // fichas: product-detail.js
  const view = storeViewFromUrl();
  if (view === currentStoreView()) return;   // al cerrar una ficha, product-detail.js repone el scroll
  applyStoreView(view);
  window.scrollTo({ top: st?.y || 0, behavior: 'instant' });
});

// ─── Accesos al catálogo desde el Inicio ─────────────────────────────────────
// Abre el catálogo solo con estos filtros, sin los anteriores (tarjetas por
// tipo del Inicio; "fragancias de noche" de la campaña de Halloween)
function openCatalogWith({ type = 'all', occasion = 'all' } = {}) {
  resetAllFilters();
  if (type !== 'all' || occasion !== 'all') {
    Filter.type = type;
    Filter.occasion = occasion;
    Pagination.reset();
    renderProducts();
  }
  goStoreView('catalogo');
}

// Cuántos hay de cada tipo y una foto de muestra (de preferencia uno popular)
function renderCatalogEntry(products) {
  const box = document.getElementById('catalogEntry');
  if (!box) return;
  const ofType = t => products.filter(p => t === 'entero'
    ? p.type === 'entero' || (p.enteroStock || 0) > 0
    : p.type === t);
  box.querySelectorAll('.cat-entry-card[data-catalog-type]').forEach(card => {
    const t = card.dataset.catalogType;
    const list = ofType(t);
    card.hidden = !list.length;
    const count = card.querySelector('.cat-entry-count');
    if (count) count.textContent = `${list.length} ${t === 'entero' ? 'producto' : 'perfume'}${list.length !== 1 ? 's' : ''}`;
    const sample = list.filter(p => p.type === t && (p.imageUrl || '').startsWith('/'))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))[0];
    const wrap = card.querySelector('.cat-entry-img');
    if (wrap && sample) wrap.innerHTML = `<img src="${escapeAttr(sample.imageUrl)}" alt="" loading="lazy" onerror="this.remove()">`;
  });
  const total = document.getElementById('catEntryTotal');
  if (total) total.textContent = products.length;
}

document.addEventListener('catalogLoaded', e => renderCatalogEntry(e.detail || []));

document.addEventListener('DOMContentLoaded', () => {
  applyStoreView(currentStoreView());

  // Links con su propio destino (el script del menú en index.html los deja pasar)
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-catalog-type]');
    if (card) { e.preventDefault(); openCatalogWith({ type: card.dataset.catalogType }); return; }
    const go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); goStoreView(go.dataset.go, { section: go.dataset.section || null }); }
  });

  // El test de fragancias también se abre desde el Inicio (su botón vive en el catálogo)
  document.getElementById('catEntryFinderBtn')?.addEventListener('click', () => {
    document.getElementById('startScentFinderBtn')?.click();
  });
});
