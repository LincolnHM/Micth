// ─── MICHT Decants · Próximamente ─────────────────────────────────────────────
// Perfumes que todavía no llegan (isComingSoon, en cloud-products.js). No entran
// al catálogo, a la búsqueda ni al Scent Finder: solo se muestran aquí, sin
// precio, con un botón para pedir aviso por WhatsApp. En cuanto el admin les
// pone los ml del frasco en el panel pasan solos al catálogo, y si ya no queda
// ninguno por llegar la sección se oculta.

let _comingSoonProducts = [];

function comingSoonWaUrl(p) {
  const text = `Hola, vi que pronto llega ${p.brand} – ${p.name}. ¿Me avisas cuando esté disponible?`;
  return `https://wa.me/51917452643?text=${encodeURIComponent(text)}`;
}

// Flechas solo si las tarjetas no entran en el ancho (en el celular se desliza)
function _soonSyncArrows() {
  const track = document.getElementById('soonTrack');
  if (!track) return;
  const overflow = track.scrollWidth > track.clientWidth + 4;
  ['soonPrev', 'soonNext'].forEach(id => { const b = document.getElementById(id); if (b) b.hidden = !overflow; });
}

function renderComingSoon() {
  const section = document.getElementById('proximamente');
  const track   = document.getElementById('soonTrack');
  if (!section || !track) return;
  const list = _comingSoonProducts.slice().sort((a, b) => a.id - b.id);
  if (!list.length) { section.hidden = true; track.innerHTML = ''; return; }

  const genderLbl   = { hombre: 'Hombre', mujer: 'Mujer', unisex: 'Unisex' };
  const occasionLbl = { dia: 'Día ☀️', noche: 'Noche 🌙', ambas: 'Día y noche' };
  track.innerHTML = list.map(p => {
    // Primeras notas (salida y corazón): lo que el cliente quiere saber de algo que no puede oler aún
    const notes = [p.topNotes, p.heartNotes].join(',').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4).join(' · ');
    const tags  = [genderLbl[p.gender], occasionLbl[p.occasion]].filter(Boolean).join(' · ');
    return `
      <article class="soon-card" role="listitem">
        <div class="soon-img-wrap">
          ${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(`${p.brand} ${p.name}`)}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <span class="soon-badge">Próximamente</span>
        </div>
        <div class="soon-info">
          <p class="soon-brand">${sanitize(p.brand)}</p>
          <h3 class="soon-name">${sanitize(p.name)}</h3>
          ${p.dupeOf?.name ? `<p class="soon-dupe">Se parece a <strong>${sanitize(p.dupeOf.name)}</strong></p>` : ''}
          ${tags ? `<p class="soon-tags">${tags}</p>` : ''}
          ${notes ? `<p class="soon-notes">${sanitize(notes)}</p>` : ''}
          <a class="soon-notify" href="${comingSoonWaUrl(p)}" target="_blank" rel="noopener noreferrer">🔔 Avísame cuando llegue</a>
        </div>
      </article>`;
  }).join('');

  // Aparece encima del catálogo cuando este ya cargó: sin que la página salte
  revealKeepingPlace(() => { section.hidden = false; });
  _soonSyncArrows();
}

document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('soonTrack');
  if (!track) return;
  const scroll = dir => () => {
    const card = track.querySelector('.soon-card');
    const step = card ? card.getBoundingClientRect().width + 16 : 240;
    track.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
  };
  document.getElementById('soonPrev')?.addEventListener('click', scroll(-1));
  document.getElementById('soonNext')?.addEventListener('click', scroll(1));
  window.addEventListener('resize', _soonSyncArrows);
});
