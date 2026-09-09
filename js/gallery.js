// ─── MICHT Decants — Galería pública (Envíos + Clientes) ─────────────────────
// Muestra las fotos que el admin sube desde el panel (sección "Galería").
// Si Supabase no responde o no hay fotos todavía, la sección/bloque queda
// oculto para no dejar un espacio vacío en la página.

function renderGalleryStrip(stripEl, photos) {
  stripEl.innerHTML = '';
  photos.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery-photo';
    btn.setAttribute('aria-label', 'Ver foto en grande');

    const img = document.createElement('img');
    img.src = p.image_url;
    img.alt = p.caption || '';
    img.loading = 'lazy';
    btn.appendChild(img);

    btn.addEventListener('click', () => openGalleryLightbox(p.image_url, p.caption || ''));
    stripEl.appendChild(btn);
  });
}

function openGalleryLightbox(url, caption) {
  const box = document.getElementById('galleryLightbox');
  const img = document.getElementById('galleryLightboxImg');
  if (!box || !img) return;
  img.src = url;
  img.alt = caption;
  box.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeGalleryLightbox() {
  const box = document.getElementById('galleryLightbox');
  if (!box) return;
  box.hidden = true;
  document.getElementById('galleryLightboxImg').src = '';
  document.body.style.overflow = '';
}

async function initGallerySection() {
  if (typeof CloudGallery === 'undefined') return;

  const categories = [
    { key: 'envios',   blockId: 'galleryBlockEnvios',   stripId: 'galleryStripEnvios'   },
    { key: 'clientes', blockId: 'galleryBlockClientes', stripId: 'galleryStripClientes' }
  ];

  let anyVisible = false;
  await Promise.all(categories.map(async ({ key, blockId, stripId }) => {
    const block = document.getElementById(blockId);
    const strip = document.getElementById(stripId);
    if (!block || !strip) return;
    let photos = [];
    try { photos = await CloudGallery.getAll(key); } catch (_) { photos = []; }
    if (!photos.length) { block.hidden = true; return; }
    renderGalleryStrip(strip, photos);
    block.hidden = false;
    anyVisible = true;
  }));

  const section = document.getElementById('galeria');
  if (section) section.hidden = !anyVisible;
}

document.addEventListener('DOMContentLoaded', () => {
  initGallerySection().catch(console.error);

  document.getElementById('galleryLightboxClose')?.addEventListener('click', closeGalleryLightbox);
  document.getElementById('galleryLightbox')?.addEventListener('click', e => {
    if (e.target.id === 'galleryLightbox') closeGalleryLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeGalleryLightbox();
  });
});
