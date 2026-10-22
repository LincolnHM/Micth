// ─── Campañas visuales de temporada ──────────────────────────────────────────
// El admin elige la campaña en el panel (Ajustes → Campañas). Toda campaña pone
// una franja bajo el encabezado, un banner en el Inicio, lluvia de emojis y un
// estallido de íconos al agregar al carrito. Una campaña puede ir más allá (ver
// 'halloween'):
//   · slide  → su propio slide al inicio del carrusel
//   · picks  → una selección de perfumes del catálogo en vez del banner
//   · decor  → decoración propia en vez de la lluvia (CAMPAIGN_DECOR, y los
//              estilos de body[data-campaign="…"] en style.css)

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
      ribbon: 'Fragancias misteriosas para la noche más oscura',
      ribbonIcon: '🎃',
      headline: 'Halloween',
      subtitle: 'Aromas oscuros y seductores para la noche más misteriosa del año.',
      artClass: 'seasonal-art-halloween',
      decor: 'halloween',
      slide: {
        tag: 'ESPECIAL DE HALLOWEEN',
        titleHtml: 'La noche más oscura<br>huele <em class="c-gold">así.</em>',
        subtitle: 'Ámbar, cuero, oud y vainilla: fragancias intensas y seductoras para la noche más misteriosa del año.',
        cta: { text: 'Ver fragancias de noche', href: '#catalogo', occasion: 'noche' },
        theme: 'slide-campaign'
      },
      picks: {
        eyebrow: '🎃 Especial de Halloween',
        titleHtml: 'Aromas para la noche más <em>oscura</em>',
        subtitle: 'Los más intensos y seductores del catálogo: ámbar, cuero, oud y vainilla.',
        cta: 'Ver todas las fragancias de noche',
        occasion: 'noche',
        // acordes "oscuros" (sin tildes): suben un perfume de noche en la selección
        words: ['ambar', 'cuero', 'ahumad', 'oud', 'tabaco', 'incienso', 'especiad', 'vainill', 'balsam', 'cacao', 'cafe', 'ron', 'amielad', 'pachuli', 'animal']
      }
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
      hero.className = 'seasonal-hero-banner view-inicio';   // solo en la pestaña Inicio
      const anchor = document.getElementById('catalogEntry') || document.getElementById('catalogToolbar');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(hero, anchor);
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
    // Con `picks` el banner se reemplaza por la selección de perfumes (renderPicks)
    if (!cfg || cfg.picks) {
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

    // "Especial de Halloween · Fragancias misteriosas… · Ver selección →"
    // (antes decía "Campaña activa:", que es lenguaje del panel, no del cliente)
    const ribbon = ensureRibbon();
    const el = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
    ribbon.innerHTML = '';
    ribbon.classList.toggle('has-link', !!cfg.picks);   // en el celular, con link se oculta la frase larga
    if (cfg.ribbonIcon) ribbon.appendChild(el('span', cfg.ribbonIcon));
    ribbon.appendChild(el('strong', cfg.picks ? 'Especial de ' + cfg.label : cfg.label));
    ribbon.appendChild(el('span', '·', 'seasonal-ribbon-text'));
    ribbon.appendChild(el('span', cfg.ribbon, 'seasonal-ribbon-text'));
    if (cfg.picks) {
      const link = el('button', 'Ver selección →');
      link.type = 'button';
      link.className = 'seasonal-ribbon-link';
      link.addEventListener('click', () => {
        if (typeof openCatalogWith === 'function') openCatalogWith({ occasion: cfg.picks.occasion });
        else location.href = '/?momento=' + cfg.picks.occasion + '#catalogo';   // desde Nosotros o Contacto
      });
      ribbon.appendChild(link);
    }
  }

  // ─── Selección de perfumes de la campaña (`picks`) ────────────────────────
  // Fila de perfumes del catálogo debajo del carrusel: los del momento pedido
  // (ej. noche) con más acordes de la lista `words`. Solo disponibles, con foto
  // y precio. Se arma sola con el catálogo real, sin elegir nada a mano.
  let _picksCampaign = null;

  function pickProducts(cfg) {
    const all  = (typeof _allProducts !== 'undefined' && _allProducts) || [];
    const dark = text => cfg.words.some(w => normalizeStr(text).includes(w));   // normalizeStr: sin tildes (catalog-view.js)
    return all
      .filter(p => p.type !== 'entero' && p.occasion === cfg.occasion && (p.imageUrl || '').startsWith('/')
                && productIsPurchasable(p) && productMinPrice(p) > 0)
      .map(p => ({
        p,
        score: (p.accords || []).slice(0, 5).reduce((sum, a) => sum + (dark(a.name) ? (a.pct || 50) / 100 : 0), 0)
               + (dark(p.olfFamily) ? .5 : 0) + (p.featured ? .3 : 0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.p);
  }

  function removePicks() {
    document.getElementById('seasonalPicks')?.remove();
  }

  function renderPicks(campaign) {
    _picksCampaign = campaign;
    removePicks();
    const cfg = CAMPAIGNS[campaign]?.picks;
    const carousel = document.getElementById('carouselWrapper');
    if (!cfg || !carousel || typeof productMiniCardHtml !== 'function') return;
    const products = pickProducts(cfg);
    if (products.length < 4) return;   // catálogo aún sin cargar (se reintenta en 'catalogLoaded') o muy pocos

    const section = document.createElement('section');
    section.id = 'seasonalPicks';
    section.className = 'seasonal-picks view-inicio';
    section.setAttribute('aria-labelledby', 'seasonalPicksTitle');
    // Textos fijos de CAMPAIGNS (no vienen del usuario); las tarjetas escapan sus datos
    section.innerHTML = `
      <div class="container">
        <div class="combos-heading">
          <span class="combos-eyebrow">${cfg.eyebrow}</span>
          <h2 class="combos-title" id="seasonalPicksTitle">${cfg.titleHtml}</h2>
          <p class="combos-subtitle">${cfg.subtitle}</p>
        </div>
        <div class="seasonal-picks-track" role="list">${products.map(productMiniCardHtml).join('')}</div>
        <div class="seasonal-picks-actions">
          <button type="button" class="seasonal-picks-all">${cfg.cta} →</button>
        </div>
      </div>`;
    bindMiniCards(section);
    section.querySelector('.seasonal-picks-all').addEventListener('click', () => openCatalogWith({ occasion: cfg.occasion }));
    // Aparece debajo del carrusel cuando el catálogo ya cargó: sin que la página salte
    revealKeepingPlace(() => carousel.insertAdjacentElement('afterend', section));
  }

  document.addEventListener('catalogLoaded', () => { if (_picksCampaign) renderPicks(_picksCampaign); });

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

  // ─── Decoración propia de una campaña (`decor`) ───────────────────────────
  // Halloween: en el carrusel, telarañas en las esquinas, una araña que baja
  // de su hilo, murciélagos alrededor de la luna (la luna y los colores van en
  // style.css, body[data-campaign="halloween"]) y una calabaza junto a la
  // mascota; y por toda la página, un murciélago que cruza de vez en cuando.
  // Todo es decorativo: no recibe clics ni lo leen los lectores de pantalla.
  const BAT_SVG = '<svg viewBox="0 0 100 50" aria-hidden="true"><path fill="currentColor" d="M50 14C47 9 45 6 43 2c0 6-1 9-3 11C33 6 22 5 12 9 5 12 1 17 0 22c5-3 10-3 14 0 4-3 9-2 12 3 3-4 8-4 11 1 3 4 8 8 13 14 5-6 10-10 13-14 3-5 8-5 11-1 3-5 8-6 12-3 4-3 9-3 14 0-1-5-5-10-12-13C78 5 67 6 60 13c-2-2-3-5-3-11-2 4-4 7-7 12z"/></svg>';
  const SPIDER_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M14 18L4 12M14 21H2M14 24L4 30M15 27l-7 9M26 18l10-6M26 21h12M26 24l10 6M25 27l7 9"/><ellipse cx="20" cy="24" rx="8" ry="9" fill="currentColor"/><circle cx="20" cy="13" r="5" fill="currentColor"/></svg>';
  const PUMPKIN_SVG = '<svg viewBox="0 0 120 110" aria-hidden="true"><defs><radialGradient id="hwPumpkinGrad" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#ffb347"/><stop offset=".6" stop-color="#f57c14"/><stop offset="1" stop-color="#a8400a"/></radialGradient></defs><path fill="#3f6b2a" d="M57 24c-3-9-1-16 8-21l6 6c-6 3-8 8-6 15z"/><ellipse cx="60" cy="65" rx="52" ry="41" fill="url(#hwPumpkinGrad)"/><path fill="none" stroke="#9c3d08" stroke-width="2.5" opacity=".5" d="M60 24c-20 8-26 74 0 81M60 24c20 8 26 74 0 81M38 31C14 45 16 92 40 102M82 31c24 14 22 61-2 71"/><g class="hw-pumpkin-face" fill="#ffe08a"><path d="M30 54l18-7-2 18zM90 54l-18-7 2 18zM60 61l-6 10h12zM26 77l10 6 6-6 8 10 10-8 10 8 8-10 6 6 10-6c-6 20-62 20-68 0z"/></g></svg>';

  // Telaraña de esquina: radios desde el vértice y anillos que cuelgan entre ellos
  function cobwebSvg() {
    const angles = [0, 18, 36, 54, 72, 90].map(d => d * Math.PI / 180);
    const pt = (r, a) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
    let d = angles.map(a => `M0 0L${pt(200, a)}`).join('');
    [45, 85, 125, 165].forEach(r => {
      for (let i = 0; i < angles.length - 1; i++) d += `M${pt(r, angles[i])}Q${pt(r * .86, (angles[i] + angles[i + 1]) / 2)} ${pt(r, angles[i + 1])}`;
    });
    return `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  const CAMPAIGN_DECOR = {
    halloween: {
      _timer: null,

      mount() {
        const hero = document.getElementById('carouselWrapper');
        if (hero) {
          const deco = document.createElement('div');
          deco.className = 'hw-hero-deco';
          deco.setAttribute('aria-hidden', 'true');
          // .hw-moon y sus dos murciélagos son la versión de celular (ahí la mascota no se muestra)
          deco.innerHTML = `
            <div class="hw-moon">${[1, 2].map(n => `<div class="hw-bat hw-bat-m${n}">${BAT_SVG}</div>`).join('')}</div>
            <div class="hw-web hw-web-l">${cobwebSvg()}</div>
            <div class="hw-web hw-web-r">${cobwebSvg()}</div>
            <div class="hw-spider"><i></i>${SPIDER_SVG}</div>
            <div class="hw-fog"></div>`;
          hero.appendChild(deco);
          // Con la mascota: murciélagos delante de la luna (que es su ::before) y la calabaza a sus pies
          const mascot = hero.querySelector('.hero-mascot');
          if (mascot) {
            const extra = document.createElement('div');
            extra.className = 'hw-mascot-deco';
            extra.innerHTML = [1, 2, 3, 4].map(n => `<div class="hw-bat hw-bat-${n}">${BAT_SVG}</div>`).join('')
              + `<div class="hw-pumpkin">${PUMPKIN_SVG}</div>`;
            mascot.appendChild(extra);
          }
        }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const layer = document.createElement('div');
        layer.id = 'hwBatLayer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
        setTimeout(() => this._spawnBat(), 1800);
        this._timer = setInterval(() => { if (Math.random() < .55) this._spawnBat(); }, 5000);
      },

      // Un murciélago cruza la parte alta de la pantalla. Pocos a la vez, y
      // ninguno mientras el cliente mira una ficha o su carrito.
      _spawnBat() {
        const layer = document.getElementById('hwBatLayer');
        if (!layer || document.hidden || layer.childElementCount >= 2) return;
        if (document.body.classList.contains('pd-open') || document.querySelector('.cart-sidebar.open')) return;
        // En el catálogo, donde el cliente está eligiendo, pasan mucho menos
        if (document.documentElement.dataset.view === 'catalogo' && Math.random() < .65) return;
        const bat = document.createElement('div');
        bat.className = 'hw-fly' + (Math.random() < .5 ? ' hw-fly-back' : '');
        bat.style.top = (10 + Math.random() * 36).toFixed(1) + 'vh';
        bat.style.setProperty('--hw-size', (24 + Math.random() * 24).toFixed(0) + 'px');
        bat.style.animationDuration = (9 + Math.random() * 6).toFixed(1) + 's';
        bat.innerHTML = BAT_SVG;
        layer.appendChild(bat);
        bat.addEventListener('animationend', e => { if (e.target === bat) bat.remove(); });
      },

      unmount() {
        clearInterval(this._timer);
        this._timer = null;
        document.querySelectorAll('.hw-hero-deco, .hw-mascot-deco, #hwBatLayer').forEach(el => el.remove());
      }
    }
  };

  let _decor = null;
  function mountDecor(name) {
    if (_decor === name) return;
    if (_decor) CAMPAIGN_DECOR[_decor]?.unmount();
    _decor = name;
    if (name) CAMPAIGN_DECOR[name]?.mount();
  }

  let _applied = null;
  function applyCampaign(campaign) {
    const normalized = normalizeCampaign(campaign);
    if (normalized === _applied) return;   // ya está puesta (venía del caché): no redibujar
    _applied = normalized;
    const cfg = CAMPAIGNS[normalized] || null;
    if (cfg) document.body.setAttribute('data-campaign', normalized);
    else document.body.removeAttribute('data-campaign');
    // Lluvia de emojis, salvo que la campaña traiga su propia decoración
    if (cfg && !cfg.decor) startEmojiRain(normalized);
    else stopEmojiRain();
    mountDecor(cfg?.decor || null);
    if (typeof Carousel !== 'undefined') Carousel.setCampaignSlide(cfg?.slide || null);
    renderRibbon(normalized);
    renderCampaignHero(normalized);
    renderPicks(normalized);
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
      const btn = e.target.closest('.size-btn:not([disabled]), .pd-size-card:not([disabled]), #pdCartBtn, #pdBuyBtn');
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
    // Primero la última campaña conocida (caché de la visita anterior): así no
    // se ve el diseño normal un instante antes de que responda la nube
    applyCampaign(readLocalCampaign());

    if (typeof SiteTheme !== 'undefined' && SiteTheme && typeof SiteTheme.getActiveCampaign === 'function') {
      try {
        applyCampaign(await SiteTheme.getActiveCampaign());
      } catch (err) {
        console.error('[MICHT] No se pudo cargar campana desde SiteTheme:', err);
      }
    }
  }

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    applyCampaign(readLocalCampaign());
  });

  // Exponer burstDecor globalmente para el panel de administración
  window.burstCampaignDecor = burstDecor;

  document.addEventListener('DOMContentLoaded', () => {
    setupBurstListener();
    loadCampaign().catch(console.error);
  });
})();
