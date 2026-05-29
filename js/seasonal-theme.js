// ─── Campanas visuales de temporada ─────────────────────────────────────────

(function () {
  const STORAGE_KEY = 'micht_site_theme';

  const CAMPAIGNS = {
    'dia-madre': {
      label: 'Día de la Madre',
      ribbon: 'Celebra a mama con fragancias inolvidables',
      headline: 'Edicion Dia de la Madre',
      subtitle: 'Detalles delicados para sorprender a mama con un perfume especial.',
      artClass: 'seasonal-art-mother'
    },
    'dia-padre': {
      label: 'Día del Padre',
      ribbon: 'Regalos elegantes para papa',
      headline: 'Edicion Dia del Padre',
      subtitle: 'Aromas con presencia para regalar en esta fecha especial.',
      artClass: 'seasonal-art-father'
    },
    'san-juan': {
      label: 'San Juan',
      ribbon: 'Edicion especial de fiesta amazonica',
      headline: 'Fiesta de San Juan',
      subtitle: 'Fragancias vibrantes para celebrar la alegria de nuestra Amazonia.',
      artClass: 'seasonal-art-sanjuan'
    },
    'navidad': {
      label: 'Navidad',
      ribbon: 'Especial navideno: perfumes para regalar',
      headline: 'Temporada Navidena',
      subtitle: 'Encuentra el regalo perfecto con ediciones para compartir en familia.',
      artClass: 'seasonal-art-navidad'
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
    hero.innerHTML =
      '<div class="container">' +
      '  <div class="seasonal-hero-box ' + cfg.artClass + '">' +
      '    <div class="seasonal-hero-copy">' +
      '      <p class="seasonal-hero-kicker">Campana especial</p>' +
      '      <h2>' + cfg.headline + '</h2>' +
      '      <p>' + cfg.subtitle + '</p>' +
      '    </div>' +
      '    <div class="seasonal-hero-art" aria-hidden="true"></div>' +
      '  </div>' +
      '</div>';
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

  function applyCampaign(campaign) {
    const normalized = normalizeCampaign(campaign);
    if (normalized === 'default') {
      document.body.removeAttribute('data-campaign');
    } else {
      document.body.setAttribute('data-campaign', normalized);
    }
    renderRibbon(normalized);
    renderCampaignHero(normalized);
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
    loadCampaign().catch(console.error);
  });
})();
