// ─── MICHT Decants · Anuncio de bienvenida ────────────────────────────────────
// Modal que se muestra una vez por sesión al entrar a la tienda, si el admin
// lo dejó activado en el panel (Ajustes → Anuncio de bienvenida). Puede ser
// una foto tipo afiche, texto simple, o ambos.

const ANNOUNCEMENT_SEEN_KEY = 'micht_announcement_seen';

function _annEscapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildAnnouncementModal(settings) {
  const hasImage = !!settings.imageUrl;

  const overlay = document.createElement('div');
  overlay.id = 'announcementModal';
  overlay.className = 'announce-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Anuncio');

  const ctaHtml = settings.ctaAction !== 'none' && settings.ctaText
    ? `<button class="announce-cta" id="announceCtaBtn">${sanitize(settings.ctaText)}</button>`
    : '';

  const imageHtml = hasImage
    ? `<div class="announce-img-wrap"><img class="announce-img" src="${_annEscapeAttr(settings.imageUrl)}" alt="${_annEscapeAttr(settings.title || 'Anuncio')}"></div>`
    : '';

  const bodyHtml = (!hasImage && settings.emoji ? `<div class="announce-emoji">${sanitize(settings.emoji)}</div>` : '')
    + (settings.title   ? `<h3 class="announce-title">${sanitize(settings.title)}</h3>`     : '')
    + (settings.message ? `<p class="announce-message">${sanitize(settings.message)}</p>`   : '')
    + ctaHtml;

  overlay.innerHTML = `
    <div class="announce-backdrop"></div>
    <div class="announce-box ${hasImage ? 'announce-box-img' : ''}">
      <button class="announce-close ${hasImage ? 'announce-close-overlay' : ''}" id="announceCloseBtn" aria-label="Cerrar">✕</button>
      ${imageHtml}
      ${bodyHtml ? `<div class="announce-body">${bodyHtml}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
    try { sessionStorage.setItem(ANNOUNCEMENT_SEEN_KEY, '1'); } catch {}
  }

  overlay.querySelector('.announce-backdrop').addEventListener('click', close);
  document.getElementById('announceCloseBtn').addEventListener('click', close);
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  });

  document.getElementById('announceCtaBtn')?.addEventListener('click', () => {
    if (settings.ctaAction === 'whatsapp') {
      window.open('https://wa.me/51917452643', '_blank', 'noopener,noreferrer');
    } else if (settings.ctaAction === 'catalog') {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    }
    close();
  });

  requestAnimationFrame(() => overlay.classList.add('open'));
}

async function initAnnouncement() {
  if (typeof SiteAnnouncement === 'undefined') return;
  try {
    if (sessionStorage.getItem(ANNOUNCEMENT_SEEN_KEY)) return;
  } catch {}

  let settings;
  try {
    settings = await SiteAnnouncement.getSettings();
  } catch {
    return;
  }

  if (!settings?.enabled) return;
  if (!settings.title && !settings.message && !settings.imageUrl) return;

  setTimeout(() => buildAnnouncementModal(settings), 900);
}

document.addEventListener('DOMContentLoaded', () => {
  initAnnouncement().catch(() => {});
});
