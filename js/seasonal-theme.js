// ─── Campanas visuales de temporada ─────────────────────────────────────────

(function () {
  const STORAGE_KEY = 'micht_site_theme';

  const CAMPAIGNS = {
    'dia-madre': {
      label: 'Día de la Madre',
      ribbon: 'Celebra a mamá con fragancias inolvidables 🌸',
      headline: 'Edición Día de la Madre',
      subtitle: 'Detalles delicados para sorprender a mamá con un perfume especial.',
      artClass: 'seasonal-art-mother'
    },
    'dia-padre': {
      label: 'Día del Padre',
      ribbon: 'Regalos elegantes para papá 👔',
      headline: 'Edición Día del Padre',
      subtitle: 'Aromas con presencia para regalar en esta fecha especial.',
      artClass: 'seasonal-art-father'
    },
    'san-juan': {
      label: 'San Juan',
      ribbon: 'Edición especial de fiesta amazónica 🌿',
      headline: 'Fiesta de San Juan',
      subtitle: 'Fragancias vibrantes para celebrar la alegría de nuestra Amazonía.',
      artClass: 'seasonal-art-sanjuan'
    },
    'navidad': {
      label: 'Navidad',
      ribbon: 'Especial navideño: perfumes para regalar 🎄',
      headline: 'Temporada Navideña',
      subtitle: 'Encuentra el regalo perfecto con ediciones para compartir en familia.',
      artClass: 'seasonal-art-navidad'
    },
    'fiestas-patrias': {
      label: 'Fiestas Patrias',
      ribbon: '¡Viva el Perú! Fragancias para celebrar 🇵🇪',
      headline: 'Fiestas Patrias del Perú',
      subtitle: 'Celebra el 28 y 29 de julio con fragancias únicas, orgullo peruano.',
      artClass: 'seasonal-art-patrias'
    },
    'san-valentin': {
      label: 'San Valentín',
      ribbon: 'El regalo más especial: un perfume con amor ❤️',
      headline: 'San Valentín',
      subtitle: 'Sorprende a esa persona especial con una fragancia que no olvidará.',
      artClass: 'seasonal-art-valentin'
    },
    'halloween': {
      label: 'Halloween',
      ribbon: 'Fragancias misteriosas para la noche más oscura 🎃',
      headline: 'Halloween',
      subtitle: 'Aromas oscuros y seductores para la noche más misteriosa del año.',
      artClass: 'seasonal-art-halloween'
    },
    'anio-nuevo': {
      label: 'Año Nuevo',
      ribbon: '¡Feliz Año Nuevo! Empieza el año con tu mejor fragancia 🎆',
      headline: 'Año Nuevo',
      subtitle: 'El mejor inicio de año con una fragancia que te acompañe todo el camino.',
      artClass: 'seasonal-art-anionuevo'
    }
  };

  function normalizeCampaign(value) {
    const key = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(CAMPAIGNS, key) ? key : 'default';
  }

  function getHeaderElement() {
    return document.querySelector('.header');
  }

  function ensureRibbon() {
    let ribbon = document.getElementById('seasonalRibbon');
    if (!ribbon) {
      ribbon = document.createElement('div');
      ribbon.id = 'seasonalRibbon';
      ribbon.className = 'seasonal-ribbon';
      const header = getHeaderElement();
      if (header && header.parentNode) {
        header.parentNode.insertBefore(ribbon, header.nextSibling);
      } else {
        document.body.insertBefore(ribbon, document.body.firstChild);
      }
    }
    return ribbon;
  }

  function hideRibbon() {
    const ribbon = document.getElementById('seasonalRibbon');
    if (ribbon) ribbon.remove();
  }

  function ensureCampaignHero() {
    let hero = document.getElementById('seasonalHeroBanner');
    if (!hero) {
      hero = document.createElement('section');
      hero.id = 'seasonalHeroBanner';
      hero.className = 'seasonal-hero-banner';
      const filters = document.getElementById('catalogo');
      if (filters && filters.parentNode) {
        filters.parentNode.insertBefore(hero, filters);
      } else {
        const firstMain = document.querySelector('main');
        if (firstMain && firstMain.parentNode) firstMain.parentNode.insertBefore(hero, firstMain);
      }
    }
    return hero;
  }

  function hideCampaignHero() {
    const hero = document.getElementById('seasonalHeroBanner');
    if (hero) hero.remove();
  }

  function renderCampaignHero(campaign) {
    if (campaign === 'default') {
      hideCampaignHero();
      return;
    }
    const cfg = CAMPAIGNS[campaign];
    if (!cfg) {
      hideCampaignHero();
      return;
    }

    const hero = ensureCampaignHero();
    // Usamos DOM seguro en lugar de innerHTML para evitar XSS
    const container = document.createElement('div');
    container.className = 'container';
    const box = document.createElement('div');
    box.className = 'seasonal-hero-box ' + cfg.artClass;
    const copy = document.createElement('div');
    copy.className = 'seasonal-hero-copy';
    const kicker = document.createElement('p');
    kicker.className = 'seasonal-hero-kicker';
    kicker.textContent = 'Campaña especial';
    const heading = document.createElement('h2');
    heading.textContent = cfg.headline;
    const sub = document.createElement('p');
    sub.textContent = cfg.subtitle;
    const art = document.createElement('div');
    art.className = 'seasonal-hero-art';
    art.setAttribute('aria-hidden', 'true');
    copy.appendChild(kicker);
    copy.appendChild(heading);
    copy.appendChild(sub);
    box.appendChild(copy);
    box.appendChild(art);
    container.appendChild(box);
    hero.innerHTML = '';
    hero.appendChild(container);
  }

  function renderRibbon(campaign) {
    if (campaign === 'default') {
      hideRibbon();
      return;
    }

    const cfg = CAMPAIGNS[campaign];
    if (!cfg) {
      hideRibbon();
      return;
    }

    const ribbon = ensureRibbon();
    ribbon.innerHTML = '<span>Campaña activa:</span><strong>' + cfg.label + '</strong><span>·</span><span>' + cfg.ribbon + '</span>';
  }

  // ─── Lluvia de emojis ─────────────────────────────────────────────────────
  let _rainInterval = null;

  function startEmojiRain(campaign) {
    stopEmojiRain();
    const icons = CAMPAIGN_ICONS[campaign];
    if (!icons) return;

    // Inyectar estilos de animación una sola vez
    if (!document.getElementById('emojiRainStyle')) {
      const s = document.createElement('style');
      s.id = 'emojiRainStyle';
      s.textContent = `
        @keyframes emojiRainFall {
          0%   { transform: translateY(-60px) rotate(0deg); opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        .emoji-rain-drop {
          position: fixed;
          top: -50px;
          pointer-events: none;
          z-index: 9998;
          font-size: 1.5rem;
          line-height: 1;
          animation: emojiRainFall linear forwards;
          user-select: none;
        }
      `;
      document.head.appendChild(s);
    }

    const MAX_DROPS = 30; // Límite de drops simultáneos en DOM

    function spawnDrop() {
      // Control de memoria: no crear más drops si ya hay muchos
      if (document.querySelectorAll('.emoji-rain-drop').length >= MAX_DROPS) return;
      const el  = document.createElement('span');
      el.className   = 'emoji-rain-drop';
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      el.style.left     = (Math.random() * 100) + 'vw';
      el.style.fontSize = (1 + Math.random() * 1.2).toFixed(2) + 'rem';
      el.style.animationDuration = (4 + Math.random() * 5).toFixed(1) + 's';
      el.style.animationDelay   = (Math.random() * 1.5).toFixed(2) + 's';
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }

    // Oleada inicial
    for (let i = 0; i < 10; i++) setTimeout(spawnDrop, i * 150);
    // Lluvia continua — menor frecuencia para reducir CPU
    _rainInterval = setInterval(() => {
      if (Math.random() < 0.6) spawnDrop();
    }, 800);
  }

  function stopEmojiRain() {
    clearInterval(_rainInterval);
    _rainInterval = null;
    document.querySelectorAll('.emoji-rain-drop').forEach(el => el.remove());
  }

  function applyCampaign(campaign) {
    const normalized = normalizeCampaign(campaign);
    if (normalized === 'default') {
      document.body.removeAttribute('data-campaign');
      stopEmojiRain();
    } else {
      document.body.setAttribute('data-campaign', normalized);
      startEmojiRain(normalized);
    }
    renderRibbon(normalized);
    renderCampaignHero(normalized);
  }

  // ─── Animación de íconos al agregar al carrito ─────────────────────────────

  const CAMPAIGN_ICONS = {
    'dia-madre':       ['🌸', '🌺', '💐', '🌷', '💝', '🩷'],
    'dia-padre':       ['👔', '🎁', '🧔', '⌚', '👨', '💙'],
    'san-juan':        ['🌿', '✨', '🌟', '🍃', '🎉', '🔥'],
    'navidad':         ['❄️', '🎁', '⭐', '🎄', '🎅', '✨'],
    'fiestas-patrias': ['🇵🇪', '🎆', '🦙', '❤️', '🤍', '🎉'],
    'san-valentin':    ['❤️', '💕', '🌹', '💝', '🩷', '💌'],
    'halloween':       ['🎃', '👻', '🕷️', '🦇', '🕸️', '🖤'],
    'anio-nuevo':      ['🎆', '🥂', '✨', '🎉', '🌟', '🎊']
  };

  function burstDecor(originEl, campaign) {
    const icons = CAMPAIGN_ICONS[campaign];
    if (!icons) return;
    const rect  = originEl.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.textContent = icons[i % icons.length];
      el.style.cssText =
        'position:fixed;left:' + cx + 'px;top:' + cy + 'px;' +
        'font-size:' + (1 + Math.random() * 0.6).toFixed(2) + 'rem;' +
        'pointer-events:none;z-index:99999;line-height:1;' +
        'transform:translate(-50%,-50%);';
      document.body.appendChild(el);
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist  = 45 + Math.random() * 55;
      const tx    = Math.cos(angle) * dist;
      const ty    = Math.sin(angle) * dist - 28;
      el.animate(
        [
          { transform: 'translate(-50%,-50%) scale(0)',    opacity: 1 },
          { transform: 'translate(calc(-50% + ' + tx + 'px),calc(-50% + ' + ty + 'px)) scale(1.2)',            opacity: 1, offset: 0.5 },
          { transform: 'translate(calc(-50% + ' + (tx*1.5) + 'px),calc(-50% + ' + ((ty*1.5)+12) + 'px)) scale(0.6)', opacity: 0 }
        ],
        { duration: 700, easing: 'cubic-bezier(.25,.46,.45,.94)' }
      ).onfinish = () => el.remove();
    }
  }

  function setupBurstListener() {
    document.addEventListener('click', e => {
      const campaign = document.body.dataset.campaign;
      if (!campaign || !CAMPAIGN_ICONS[campaign]) return;
      const btn = e.target.closest('.size-btn:not([disabled]), .pd-size-btn-new, #pdCartBtn');
      if (btn) burstDecor(btn, campaign);
    }, true);
  }

  function readLocalCampaign() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 'default';
      const parsed = JSON.parse(raw);
      return normalizeCampaign(parsed?.campaign);
    } catch {
      return 'default';
    }
  }

  async function loadCampaign() {
    // Si existe la API compartida, usa nube con fallback automatico.
    if (typeof SiteTheme !== 'undefined' && SiteTheme && typeof SiteTheme.getActiveCampaign === 'function') {
      try {
        const active = await SiteTheme.getActiveCampaign();
        applyCampaign(active);
        return;
      } catch (err) {
        console.error('[MICHT] No se pudo cargar campana desde SiteTheme:', err);
      }
    }

    applyCampaign(readLocalCampaign());
  }

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    applyCampaign(readLocalCampaign());
  });

  document.addEventListener('DOMContentLoaded', () => {
    setupBurstListener();
    loadCampaign().catch(console.error);
  });
})();
