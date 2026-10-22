// ─── MICHT Decants · Recién llegados ──────────────────────────────────────────
// En el Inicio: los perfumes que entraron en los últimos 30 días (isNewArrival,
// en cloud-products.js), del más nuevo al más antiguo, con su precio, a qué se
// parece y la barra de acordes. Tocar uno abre su ficha. Agotados y los de
// "Próximamente" no entran; si no queda nada nuevo, la sección se oculta sola.

const NEW_ARRIVALS_MAX = 10;

// Flechas solo si las tarjetas no entran en el ancho (en el celular se desliza)
function _newSyncArrows() {
  const track = document.getElementById('newTrack');
  if (!track) return;
  const overflow = track.scrollWidth > track.clientWidth + 4;
  ['newPrev', 'newNext'].forEach(id => { const b = document.getElementById(id); if (b) b.hidden = !overflow; });
}

function renderNewArrivals() {
  const section = document.getElementById('nuevos');
  const track   = document.getElementById('newTrack');
  if (!section || !track) return;
  const time = p => new Date(p.date).getTime() || 0;
  const list = (_allProducts || [])
    .filter(p => isNewArrival(p) && productIsPurchasable(p))
    .sort((a, b) => (time(b) - time(a)) || (b.id - a.id))
    .slice(0, NEW_ARRIVALS_MAX);
  if (!list.length) { section.hidden = true; track.innerHTML = ''; return; }

  const genderLbl   = { hombre: 'Hombre', mujer: 'Mujer', unisex: 'Unisex' };
  const occasionLbl = { dia: 'Día ☀️', noche: 'Noche 🌙', ambas: 'Día y noche' };
  track.innerHTML = list.map(p => {
    const min  = productMinPrice(p);
    const tags = [genderLbl[p.gender], occasionLbl[p.occasion]].filter(Boolean).join(' · ');
    const price = min > 0
      ? `<p class="new-price">${p.type === 'entero' ? '' : '<small>Desde</small> '}S/ ${min}</p>`
      : '<p class="new-price"><small>Consultar precio</small></p>';
    return `
      <article class="soon-card new-card" role="listitem" data-id="${p.id}">
        <div class="soon-img-wrap">
          ${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(`${p.brand} ${p.name}`)}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <span class="soon-badge new-badge">✨ Nuevo</span>
        </div>
        <div class="soon-info">
          <p class="soon-brand">${sanitize(p.brand)}</p>
          <h3 class="soon-name">${sanitize(p.name)}</h3>
          ${p.dupeOf?.name ? `<p class="soon-dupe">Se parece a <strong>${sanitize(p.dupeOf.name)}</strong></p>` : ''}
          ${tags ? `<p class="soon-tags">${tags}</p>` : ''}
          ${accordStripHtml(p, { bars: 5, names: 2 })}
          <div class="new-foot">
            ${price}
            <button type="button" class="new-cta" aria-label="Ver ${escapeAttr(`${p.brand} ${p.name}`)}">Ver perfume →</button>
          </div>
        </div>
      </article>`;
  }).join('');

  // Toda la tarjeta abre la ficha (el botón queda para el teclado)
  track.querySelectorAll('.new-card').forEach(card => {
    card.addEventListener('click', () => openPdModal(parseInt(card.dataset.id)));
  });

  // Aparece cuando el catálogo ya cargó: sin que la página salte
  revealKeepingPlace(() => { section.hidden = false; });
  _newSyncArrows();
}

document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('newTrack');
  if (!track) return;
  const scroll = dir => () => {
    const card = track.querySelector('.new-card');
    const step = card ? card.getBoundingClientRect().width + 16 : 240;
    track.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
  };
  document.getElementById('newPrev')?.addEventListener('click', scroll(-1));
  document.getElementById('newNext')?.addEventListener('click', scroll(1));
  document.getElementById('newAllBtn')?.addEventListener('click', () => openCatalogWith({ sort: 'new' }));
  window.addEventListener('resize', _newSyncArrows);
});
