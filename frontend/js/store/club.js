// ═══════════════════════════════════════════════════════════════════════════════
// ─── Club MICHT — tarjetas de fidelidad Golden y Black ───────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Cada pedido pagado de un cliente con cuenta suma 1 huellita:
//   de S/ 15 a S/ 59.99 → tarjeta Golden · desde S/ 60 → tarjeta Black.
// Con 9 huellitas, su siguiente pedido (el 10) lleva un 5 ml gratis:
//   Golden → cualquier árabe · Black → árabe o diseñador (sin nicho,
//   L'Immensité ni Sauvage Elixir).
// Las reglas viven en la base (backend/supabase/sql/2026-11-04-club-micht.sql);
// aquí solo se muestran las tarjetas, se elige el regalo y se avisa al cliente.
// Si ese SQL no está corrido, todo lo del Club queda oculto.

const CLUB_MIN       = 15;
const CLUB_BLACK_MIN = 60;
const CLUB_SLOTS     = 9;
const CLUB_TIERS = {
  golden: { name: 'Golden', prize: '5 ml de cualquier perfume árabe',       short: '5 ml árabe' },
  black:  { name: 'Black',  prize: '5 ml de cualquier árabe o diseñador',   short: '5 ml árabe o diseñador' }
};
const CLUB_FINE_PRINT = 'El regalo Black no incluye perfumes nicho, L’Immensité ni Sauvage Elixir.';
const CLUB_CAT_IMG    = '/imgGato/gato-removebg-preview.png';

const _CLUB_PAW  = '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="21.5" rx="7.2" ry="6.2"/><ellipse cx="7.3" cy="13.6" rx="3" ry="3.8" transform="rotate(-18 7.3 13.6)"/><ellipse cx="12.6" cy="8.3" rx="3" ry="3.9" transform="rotate(-6 12.6 8.3)"/><ellipse cx="19.4" cy="8.3" rx="3" ry="3.9" transform="rotate(6 19.4 8.3)"/><ellipse cx="24.7" cy="13.6" rx="3" ry="3.8" transform="rotate(18 24.7 13.6)"/></svg>';
const _CLUB_GIFT = '<svg viewBox="0 0 32 32" aria-hidden="true"><g class="club-gift-lid"><rect x="5" y="10" width="22" height="6" rx="1.5"/><path d="M16 10c-2-4.5-7-5.5-7.5-2.5S12 10 16 10zm0 0c2-4.5 7-5.5 7.5-2.5S20 10 16 10z" fill="none" stroke="currentColor" stroke-width="1.8"/></g><rect x="7" y="16" width="18" height="11" rx="1.5"/><rect x="14.6" y="10" width="2.8" height="17" class="club-gift-ribbon"/></svg>';

// Golden: destellos de luz sobre el oro
const _CLUB_GLINTS = [[24, 30, 11, 0], [46, 7, 9, .8], [30, 52, 9, 1.6], [63, 28, 13, 2.3], [89, 11, 10, 1.1], [80, 76, 10, 2.8], [13, 84, 10, 2]]
  .map(([x, y, z, d]) => `<i class="club-glint" aria-hidden="true" style="--x:${x}%;--y:${y}%;--z:${z}px;--d:${d}s"></i>`).join('');
// Black: humo de perfume dorado (estelas que fluyen) y polvo de oro que sube
const _CLUB_VAPOR = `<svg class="club-vapor" viewBox="0 0 320 200" preserveAspectRatio="none">
  ${[['M-10 190C40 150 20 112 80 100S150 62 200 80 280 40 332 8', 5.5, 0],
     ['M30 206C70 172 60 140 120 136S190 120 232 140 300 108 334 90', 7, 1.8],
     ['M-12 122C30 100 62 70 112 62S172 32 224 22 300 30 334 4', 6.2, 3.4]]
    .map(([d, t, delay]) => `<path class="v-base" d="${d}"/><path class="v-flow" pathLength="420" style="--t:${t}s;--d:${delay}s" d="${d}"/>`).join('')}
</svg>`;
const _CLUB_DUST = [[6, 0, 5.2, 8, 2.5], [17, 2.4, 6, -10, 3], [28, 1.1, 4.6, 12, 2], [39, 3.6, 5.6, -6, 3.5], [51, .5, 6.4, 9, 2.5],
  [60, 2.9, 4.8, -12, 2], [70, 1.7, 5.8, 7, 3], [81, 4.2, 5, -8, 2.5], [90, .9, 6.2, 10, 3], [96, 3.1, 4.4, -5, 2]]
  .map(([x, d, t, sx, z]) => `<i class="club-dust" style="--x:${x}%;--d:${d}s;--t:${t}s;--sx:${sx}px;--z:${z}px"></i>`).join('');

const Club = {
  enabled: null,       // null: aún no se sabe · true/false: el SQL del Club está (o no) corrido
  state:   null,       // respuesta de club_mi_tarjeta()
  _uid:    null,
  _loading: null,
  _tab:    null,

  // ─── Reglas ──────────────────────────────────────────────────────────────
  tierFor(total) { return total >= CLUB_BLACK_MIN ? 'black' : total >= CLUB_MIN ? 'golden' : null; },
  isMember()     { return !!this.state?.miembro; },

  // Estado de una tarjeta listo para mostrar
  info(tier) {
    const t = this.state?.[tier] || {};
    const saldo     = parseInt(t.saldo) || 0;
    const enCamino  = parseInt(t.regalo_en_camino) || 0;
    const libres    = saldo - CLUB_SLOTS * enCamino;          // huellitas libres
    const paws      = enCamino ? CLUB_SLOTS : Math.max(0, Math.min(CLUB_SLOTS, libres));
    return {
      tier, saldo, paws,
      enCamino:     enCamino > 0,
      listo:        !enCamino && libres >= CLUB_SLOTS,
      extra:        Math.max(0, libres - CLUB_SLOTS),
      faltan:       Math.max(0, CLUB_SLOTS - paws),
      completadas:  parseInt(t.completadas) || 0,
      porConfirmar: parseInt(t.por_confirmar) || 0
    };
  },
  readyTiers() { return this.isMember() ? ['golden', 'black'].filter(t => this.info(t).listo) : []; },
  // La tarjeta que más conviene mostrar primero
  bestTier() {
    if (!this.isMember()) return 'golden';
    const g = this.info('golden'), b = this.info('black');
    if (b.listo || b.enCamino) return 'black';
    if (g.listo || g.enCamino) return 'golden';
    return b.paws > g.paws ? 'black' : 'golden';
  },

  // ─── Carga ───────────────────────────────────────────────────────────────
  async load(force = false) {
    if (typeof authClient === 'undefined' || !authClient) { this._setEnabled(false); return; }
    const uid = (typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn()) ? UserAuth._currentUser?.id || null : null;
    if (!force && this._loading && this._uid === uid) return this._loading;
    this._uid = uid;
    // Sin sesión basta saber una vez por visita que el Club existe
    if (!uid && !force) {
      try {
        const cached = sessionStorage.getItem('clubOn');
        if (cached) { this.state = { miembro: false }; this._setEnabled(cached === '1'); return; }
      } catch (_) {}
    }
    this._loading = (async () => {
      try {
        const { data, error } = await authClient.rpc('club_mi_tarjeta');
        if (error) {
          const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find|does not exist/i.test(error.message || '');
          if (missing) { this.state = null; this._setEnabled(false); try { sessionStorage.setItem('clubOn', '0'); } catch (_) {} }
          return;
        }
        if (this._uid !== uid) return;                 // cambió la sesión mientras cargaba
        this.state = data || { miembro: false };
        try { sessionStorage.setItem('clubOn', '1'); } catch (_) {}
        this._setEnabled(true);
        this._maybeNotify();
      } catch (_) { /* sin red: se reintenta en la próxima carga */ }
      finally { this._loading = null; }
    })();
    return this._loading;
  },

  // Cambió la sesión del cliente (lo llama UserAuth._updateHeaderUI)
  onAuthChange() {
    const uid = (typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn()) ? UserAuth._currentUser?.id || null : null;
    if (uid === this._uid && this.state) { this.renderAll(); return; }
    this.state = null;
    this.load(true);
  },

  _setEnabled(on) {
    this.enabled = on;
    this.renderAll();
  },

  renderAll() {
    this.renderHome();
    this.renderEntryPoints();
    if (typeof UserAuth !== 'undefined') UserAuth._updatePromoBanner?.();
    if (typeof Checkout !== 'undefined' && document.getElementById('checkoutModal')?.classList.contains('open')) Checkout.renderSummary();
    if (document.getElementById('clubOverlay')?.classList.contains('open')) this._renderModal();
  },

  // ─── Tarjeta ─────────────────────────────────────────────────────────────
  // info: resultado de info(); opts.holder: nombre impreso; opts.fresh: huellitas
  // recién ganadas (se estampan con animación)
  cardHtml(tier, info, { holder = '', fresh = 0, play = false } = {}) {
    const T = CLUB_TIERS[tier];
    const slots = [];
    for (let i = 0; i < CLUB_SLOTS; i++) {
      const on    = i < info.paws;
      const isNew = on && i >= info.paws - fresh;
      const next  = !on && i === info.paws;
      slots.push(`<span class="club-slot${on ? ' is-on' : ''}${isNew ? ' is-new' : ''}${next ? ' is-next' : ''}" style="--i:${i}">${_CLUB_PAW}</span>`);
    }
    slots.push(`<span class="club-slot club-slot--gift${info.listo ? ' is-ready' : ''}${info.enCamino ? ' is-transit' : ''}" style="--i:9" title="Regalo: ${escapeAttr(T.prize)}">${_CLUB_GIFT}</span>`);
    const fx = tier === 'black' ? _CLUB_VAPOR + _CLUB_DUST : '';
    const glints = tier === 'golden' ? _CLUB_GLINTS : '';
    return `
      <div class="club-card club-card--${tier}${info.listo ? ' is-ready' : ''}${play ? ' club-play' : ''}" data-tier="${tier}">
        <span class="club-card-fx" aria-hidden="true">${fx}</span>
        <span class="club-card-shine" aria-hidden="true"></span>
        ${glints}
        <div class="club-card-top">
          <span class="club-card-brand">CLUB <b>MICHT</b></span>
          <span class="club-card-tier">${T.name.toUpperCase()}</span>
        </div>
        <img class="club-card-cat" src="${CLUB_CAT_IMG}" alt="" aria-hidden="true" loading="lazy">
        <div class="club-card-slots" role="img" aria-label="${info.paws} de ${CLUB_SLOTS} huellitas${info.listo ? ', regalo listo' : ''}">${slots.join('')}</div>
        <div class="club-card-foot">
          <span class="club-card-holder">${sanitize(holder || 'TU NOMBRE AQUÍ')}</span>
          <span class="club-card-count"><b>${info.paws}</b>/${CLUB_SLOTS}</span>
        </div>
      </div>`;
  },

  _demoInfo(tier) {
    const paws = tier === 'golden' ? 4 : 7;
    return { tier, paws, saldo: paws, listo: false, enCamino: false, extra: 0, faltan: CLUB_SLOTS - paws, completadas: 0, porConfirmar: 0 };
  },

  _holder() {
    const n = (typeof UserAuth !== 'undefined' && UserAuth.getProfile()?.nombre_completo) || '';
    return n.trim().split(/\s+/).slice(0, 2).join(' ').toUpperCase();
  },

  // Huellitas que el cliente aún no vio (para estamparlas con animación)
  _freshFor(tier, info) {
    if (!this._uid) return 0;
    try {
      const seen = JSON.parse(localStorage.getItem('clubSeen_' + this._uid) || 'null');
      if (!seen || typeof seen[tier] !== 'number') return 0;
      return Math.max(0, Math.min(3, info.paws - seen[tier]));
    } catch (_) { return 0; }
  },
  _markSeen() {
    if (!this._uid || !this.isMember()) return;
    try {
      localStorage.setItem('clubSeen_' + this._uid, JSON.stringify({ golden: this.info('golden').paws, black: this.info('black').paws }));
    } catch (_) {}
  },

  // ─── Sección en Inicio ───────────────────────────────────────────────────
  renderHome() {
    const sec = document.getElementById('clubHome');
    if (!sec) return;
    sec.hidden = !this.enabled;
    if (!this.enabled) return;
    const member = this.isMember();
    const cards  = document.getElementById('clubHomeCards');
    const g = member ? this.info('golden') : this._demoInfo('golden');
    const b = member ? this.info('black')  : this._demoInfo('black');
    const holder = member ? this._holder() : '';
    const front  = member ? this.bestTier() : 'golden';
    const back   = front === 'golden' ? 'black' : 'golden';
    const infoOf = t => t === 'golden' ? g : b;
    if (cards) {
      cards.innerHTML = `
        <div class="club-home-card is-back">${this.cardHtml(back, infoOf(back), { holder })}</div>
        <div class="club-home-card is-front">${this.cardHtml(front, infoOf(front), { holder })}</div>`;
      this._observePlay(cards);
    }
    const sub = document.getElementById('clubHomeSub');
    const cta = document.getElementById('clubHomeCta');
    if (member) {
      const fi = infoOf(front);
      if (sub) sub.innerHTML = fi.listo
        ? `🎁 <strong>¡Tu regalo ${CLUB_TIERS[front].name} está listo!</strong> Elígelo al finalizar tu próximo pedido.`
        : fi.enCamino
          ? `🚚 Tu regalo ${CLUB_TIERS[front].name} va en tu pedido. Al confirmarlo empiezas una tarjeta nueva.`
          : `Llevas <strong>${fi.paws} de ${CLUB_SLOTS}</strong> huellitas en tu ${CLUB_TIERS[front].name}. ${fi.faltan === 1 ? '¡Te falta solo 1!' : `Te faltan ${fi.faltan}.`}`;
      if (cta) { cta.textContent = 'Ver mi tarjeta'; cta.dataset.action = 'card'; }
    } else {
      if (sub) sub.innerHTML = 'Cada pedido pagado suma 1 huellita. Junta 9 y tu <strong>pedido 10 lleva un decant de 5 ml gratis</strong>.';
      const logged = typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn();
      if (cta) { cta.textContent = logged ? 'Ver mi tarjeta' : 'Crear mi cuenta gratis'; cta.dataset.action = logged ? 'card' : 'register'; }
    }
  },

  // Las animaciones de la tarjeta arrancan cuando se ve en pantalla
  _observePlay(root) {
    const cardsEls = root.querySelectorAll('.club-card');
    if (!('IntersectionObserver' in window)) { cardsEls.forEach(c => c.classList.add('club-play')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('club-play'); io.unobserve(e.target); } });
    }, { threshold: 0.35 });
    cardsEls.forEach(c => io.observe(c));
  },

  // ─── Accesos (menú de la cuenta) ─────────────────────────────────────────
  renderEntryPoints() {
    const on = !!this.enabled && typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn();
    ['headerClubBtn', 'mobileClubBtn'].forEach(id => { const b = document.getElementById(id); if (b) b.hidden = !on; });
    let badge = '';
    if (on && this.isMember()) {
      const t = this.bestTier(), i = this.info(t);
      badge = i.listo ? '🎁' : `${i.paws}/${CLUB_SLOTS}`;
    }
    document.querySelectorAll('.club-menu-badge').forEach(el => { el.textContent = badge; el.hidden = !badge; });
  },

  // ─── Modal "Mi tarjeta" ──────────────────────────────────────────────────
  open(tier) {
    let ov = document.getElementById('clubOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'clubOverlay';
      ov.className = 'club-overlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', 'Club MICHT');
      ov.innerHTML = '<div class="club-modal"><button type="button" class="club-close" aria-label="Cerrar">×</button><div class="club-modal-body"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.club-close')) this.close(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('open')) this.close(); });
    }
    this._tab = tier || this.bestTier();
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    this._renderModal();
    if (typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn()) {
      this.load(true);           // trae lo último (p. ej. si acaban de confirmarle un pago)
    }
  },
  close() {
    document.getElementById('clubOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
    this._markSeen();
  },

  _renderModal() {
    const body = document.querySelector('#clubOverlay .club-modal-body');
    if (!body) return;
    const logged = typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn();
    const member = logged && this.isMember();
    const tier   = this._tab || 'golden';
    const T      = CLUB_TIERS[tier];
    const info   = member ? this.info(tier) : this._demoInfo(tier);
    const fresh  = member ? this._freshFor(tier, info) : 0;
    const other  = t => member ? this.info(t) : this._demoInfo(t);

    const tabs = ['golden', 'black'].map(t => {
      const i = other(t);
      return `<button type="button" role="tab" class="club-tab club-tab--${t}${t === tier ? ' is-active' : ''}" data-tier="${t}" aria-selected="${t === tier}">
        ${CLUB_TIERS[t].name}<small>${member ? (i.listo ? '🎁 listo' : `${i.paws}/${CLUB_SLOTS}`) : (t === 'golden' ? 'desde S/ 15' : 'desde S/ 60')}</small></button>`;
    }).join('');

    let status = '';
    if (!logged) {
      status = `<p class="club-status-main">Crea tu cuenta gratis y cada pedido pagado de la página suma 1 huellita. <strong>Tu pedido 10 va con regalo.</strong></p>
        <div class="club-actions"><button type="button" class="club-cta" data-club="register">Crear mi cuenta gratis</button>
        <button type="button" class="club-link" data-club="login">Ya tengo cuenta</button></div>`;
    } else if (!member) {
      status = '<p class="club-status-main">Cargando tu tarjeta…</p>';
    } else {
      const main = info.enCamino
        ? `🚚 <strong>Tu regalo va en tu pedido.</strong> Cuando confirmemos el pago, empiezas una tarjeta ${T.name} nueva.`
        : info.listo
          ? `🎁 <strong>¡Tu regalo está listo!</strong> Al finalizar tu próximo pedido (desde S/ ${CLUB_MIN}) elige tu <strong>${T.prize}</strong> gratis.`
          : info.faltan === 1
            ? `🐾 <strong>¡Te falta solo 1 huellita!</strong> Con 9, tu siguiente pedido lleva ${T.short} gratis.`
            : `Te faltan <strong>${info.faltan} huellitas</strong>. Con 9, tu siguiente pedido lleva <strong>${T.short}</strong> gratis.`;
      const extras = [
        info.porConfirmar ? `⏳ ${info.porConfirmar === 1 ? 'Tienes 1 pedido' : `Tienes ${info.porConfirmar} pedidos`} esperando que confirmemos el pago: ahí suma tu huellita.` : '',
        info.extra ? `✨ +${info.extra} ${info.extra === 1 ? 'huellita guardada' : 'huellitas guardadas'} para tu próxima tarjeta.` : '',
        info.completadas ? `🏆 ${info.completadas === 1 ? '1 tarjeta completada' : `${info.completadas} tarjetas completadas`}.` : ''
      ].filter(Boolean).map(t => `<li>${t}</li>`).join('');
      status = `<p class="club-status-main">${main}</p>${extras ? `<ul class="club-status-extra">${extras}</ul>` : ''}
        ${info.listo ? '<div class="club-actions"><button type="button" class="club-cta" data-club="shop">Ir al catálogo</button></div>' : ''}`;
    }

    const hist = member ? (this.state.historial || []) : [];
    const histHtml = hist.length ? `
      <div class="club-history">
        <h3>Tus huellitas</h3>
        <ul>${hist.slice(0, 12).map(h => this._histRow(h)).join('')}</ul>
      </div>` : '';

    body.innerHTML = `
      <div class="club-modal-head">
        <span class="club-eyebrow">🐾 Club MICHT</span>
        <h2>${member ? 'Tu tarjeta' : 'Tarjetas de fidelidad'}</h2>
      </div>
      <div class="club-tabs" role="tablist" aria-label="Tarjetas">${tabs}</div>
      <div class="club-stage">${this.cardHtml(tier, info, { holder: member ? this._holder() : '', fresh, play: true })}</div>
      <div class="club-status">${status}</div>
      <details class="club-how"${member ? '' : ' open'}>
        <summary>¿Cómo funciona?</summary>
        <ul>
          <li><span class="club-dot club-dot--golden"></span><div><strong>Golden:</strong> pedidos de S/ 15 a S/ 59.99. Regalo: ${CLUB_TIERS.golden.prize}.</div></li>
          <li><span class="club-dot club-dot--black"></span><div><strong>Black:</strong> pedidos desde S/ 60. Regalo: ${CLUB_TIERS.black.prize}.</div></li>
          <li>🐾 <div>1 huellita por pedido pagado, sin importar cuántos perfumes lleve (máximo 1 por día). Tu primera compra suma 1 de bienvenida.</div></li>
          <li>🎁 <div>Con 9 huellitas, tu pedido 10 lleva el regalo gratis: lo eliges al finalizar tu pedido. Las huellitas no vencen.</div></li>
          <li>👤 <div>Suman los pedidos hechos en la página con tu sesión iniciada.</div></li>
        </ul>
        <p class="club-fine">${CLUB_FINE_PRINT}</p>
      </details>
      ${histHtml}`;

    body.querySelectorAll('.club-tab').forEach(b => b.addEventListener('click', () => { this._tab = b.dataset.tier; this._renderModal(); }));
    body.querySelector('[data-club="register"]')?.addEventListener('click', () => { this.close(); AuthModals.openRegister(); });
    body.querySelector('[data-club="login"]')?.addEventListener('click', () => { this.close(); AuthModals.openLogin(); });
    body.querySelector('[data-club="shop"]')?.addEventListener('click', () => { this.close(); goStoreView('catalogo'); });

    if (info.listo && fresh) this.confetti(body.querySelector('.club-stage'));
    if (member) setTimeout(() => this._markSeen(), 1500);
  },

  _histRow(h) {
    const T = CLUB_TIERS[h.tarjeta]?.name || '';
    const d = h.fecha ? new Date(h.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '';
    const n = parseInt(h.cantidad) || 0;
    const map = {
      compra:     ['🐾', `Pedido ${sanitize(h.pedido || '')}`],
      bienvenida: ['🎉', 'Huellita de bienvenida'],
      manual:     [n > 0 ? '✨' : '↩︎', n > 0 ? 'Regalo de MICHT' : 'Ajuste'],
      canje:      ['🎁', 'Regalo entregado · tarjeta completada']
    };
    const [icon, label] = map[h.tipo] || ['•', ''];
    const amount = h.tipo === 'canje' ? '' : `${n > 0 ? '+' : ''}${n}`;
    return `<li><span class="club-h-icon">${icon}</span>
      <span class="club-h-text">${label}${h.nota ? ` <small>${sanitize(h.nota)}</small>` : ''}<small>${d} · ${T}</small></span>
      <b class="club-h-num">${amount}</b></li>`;
  },

  // ─── Celebración ─────────────────────────────────────────────────────────
  confetti(host) {
    if (!host || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'club-confetti';
    const colors = ['#e8c46e', '#f7e2a4', '#fff4cf', '#b8892f', '#ffffff'];
    for (let i = 0; i < 36; i++) {
      const p = document.createElement('i');
      p.style.setProperty('--x', `${(Math.random() * 2 - 1) * 170}px`);
      p.style.setProperty('--y', `${-60 - Math.random() * 160}px`);
      p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      p.style.setProperty('--d', `${Math.random() * 0.25}s`);
      p.style.background = colors[i % colors.length];
      box.appendChild(p);
    }
    host.appendChild(box);
    setTimeout(() => box.remove(), 2200);
  },

  // ─── "Te falta 1" / "Tu regalo está listo" ───────────────────────────────
  _maybeNotify() {
    if (!this.isMember()) return;
    const ready = this.readyTiers()[0];
    const near  = ['black', 'golden'].find(t => { const i = this.info(t); return !i.listo && !i.enCamino && i.faltan === 1; });
    const tier  = ready || near;
    if (!tier) return;
    const key = `clubNote_${this._uid}_${tier}_${ready ? 'ready' : 'near'}_${this.info(tier).saldo}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (_) {}
    const T = CLUB_TIERS[tier];
    const text = ready
      ? `🎁 <strong>¡Tu regalo ${T.name} está listo!</strong> Elige tu ${T.short} gratis en tu próximo pedido.`
      : `🐾 <strong>¡Te falta 1 huellita!</strong> Un pedido más y tu tarjeta ${T.name} queda lista.`;
    document.querySelector('.club-toast')?.remove();
    const el = document.createElement('div');
    el.className = `club-toast club-toast--${tier}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<button type="button" class="club-toast-body">${text}<span>Ver mi tarjeta →</span></button><button type="button" class="club-toast-x" aria-label="Cerrar">×</button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const hide = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); };
    el.querySelector('.club-toast-body').addEventListener('click', () => { hide(); this.open(tier); });
    el.querySelector('.club-toast-x').addEventListener('click', hide);
    setTimeout(hide, 10000);
  },

  // ─── Checkout ────────────────────────────────────────────────────────────
  // ¿Se puede llevar el regalo de esta tarjeta en un pedido de este total?
  giftAllowed(tier, total) {
    return !!this.enabled && this.isMember() && this.info(tier).listo && total >= CLUB_MIN;
  },

  // Línea del regalo para el pedido (o null)
  giftLine(gift) {
    if (!gift) return null;
    return { productId: gift.productId, productName: gift.name, brand: gift.brand, size: '5ml', price: 0, quantity: 1, clubRegalo: gift.tier };
  },

  // Caja del Club dentro del resumen del pedido
  checkoutHtml(total, gift) {
    if (!this.enabled) return '';
    const logged = typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn();
    if (!logged) {
      return `<div class="club-co club-co--invite">
        <span class="club-co-paw">${_CLUB_PAW}</span>
        <p>Con tu cuenta, este pedido suma <strong>1 huellita</strong> del Club MICHT. <button type="button" class="club-co-link" data-club-co="login">Inicia sesión</button></p>
      </div>`;
    }
    if (!this.isMember()) return '';

    const parts = [];
    const ready = this.readyTiers();
    if (gift) {
      parts.push(`<div class="club-co club-co--gift club-co--${gift.tier}">
        <span class="club-co-paw">${_CLUB_GIFT}</span>
        <p><strong>🎁 Este es tu pedido 10.</strong> Lleva tu regalo ${CLUB_TIERS[gift.tier].name} y, al confirmarlo, empiezas una tarjeta nueva.
          <button type="button" class="club-co-link" data-club-co="change">Cambiar</button> · <button type="button" class="club-co-link" data-club-co="remove">Quitar regalo</button></p>
      </div>`);
    } else if (ready.length) {
      ready.forEach(t => {
        const ok = total >= CLUB_MIN;
        parts.push(`<div class="club-co club-co--ready club-co--${t}">
          <span class="club-co-paw">${_CLUB_GIFT}</span>
          <p><strong>¡Tu regalo ${CLUB_TIERS[t].name} está listo!</strong> ${ok
            ? `Elige tu ${CLUB_TIERS[t].short} gratis para este pedido.`
            : `Va con pedidos desde S/ ${CLUB_MIN}: te faltan S/ ${(CLUB_MIN - total).toFixed(2)}.`}</p>
          ${ok ? `<button type="button" class="club-co-btn" data-club-co="pick" data-tier="${t}">Elegir mi regalo</button>` : ''}
        </div>`);
      });
    }
    if (!gift) {
      const tier = this.tierFor(total);
      let msg;
      if (!tier) {
        msg = `Agrega <strong>S/ ${(CLUB_MIN - total).toFixed(2)}</strong> más y este pedido suma 1 huellita Golden.`;
      } else {
        const i = this.info(tier);
        const name = CLUB_TIERS[tier].name;
        const count = i.listo || i.enCamino
          ? ' (se guarda para tu próxima tarjeta)'
          : ` (${i.paws + 1}/${CLUB_SLOTS})`;
        msg = `${tier === 'black' ? '✦ ' : ''}Este pedido suma <strong>1 huellita ${name}</strong>${count} al confirmar tu pago.`;
        if (tier === 'golden') msg += ` <span class="club-co-up">Agrega S/ ${(CLUB_BLACK_MIN - total).toFixed(2)} más y suma en tu <b>Black</b> ✦</span>`;
      }
      parts.push(`<div class="club-co club-co--${tier || 'none'}"><span class="club-co-paw">${_CLUB_PAW}</span><p>${msg}</p></div>`);
    }
    return parts.join('');
  },

  // Conecta los botones de la caja del checkout
  bindCheckout(root, { onPick, onRemove }) {
    root.querySelector('[data-club-co="login"]')?.addEventListener('click', () => AuthModals.openLogin());
    root.querySelectorAll('[data-club-co="pick"]').forEach(b => b.addEventListener('click', () => this.openGiftPicker(b.dataset.tier, onPick)));
    root.querySelector('[data-club-co="change"]')?.addEventListener('click', () => this.openGiftPicker(Checkout._gift?.tier || this.readyTiers()[0], onPick));
    root.querySelector('[data-club-co="remove"]')?.addEventListener('click', onRemove);
  },

  // Perfumes que se pueden elegir de regalo (y que alcanzan junto con el carrito)
  giftOptions(tier) {
    const ids = new Set((this.state?.premios?.[tier] || []).map(Number));
    const products = (typeof _allProducts !== 'undefined' && _allProducts) || Products.getAll();
    const lookup = new Map(products.map(p => [p.id, p]));
    const cart = (typeof Cart !== 'undefined' ? Cart.items : []) || [];
    return products
      .filter(p => ids.has(p.id) && isDecantPurchasable(p) && Number(p.sizes?.['5ml']) > 0)
      .filter(p => !stockShortages([...cart, { productId: p.id, size: '5ml', quantity: 1 }], lookup).some(s => s.name === `${p.brand} ${p.name}`.trim()))
      .sort((a, b) => (Number(b.sizes['5ml']) - Number(a.sizes['5ml'])) || a.name.localeCompare(b.name));
  },

  openGiftPicker(tier, onPick) {
    if (!tier) return;
    const T = CLUB_TIERS[tier];
    const all = this.giftOptions(tier);
    const ov = document.createElement('div');
    ov.className = 'club-overlay club-picker open';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', `Elige tu regalo ${T.name}`);
    ov.innerHTML = `
      <div class="club-modal club-picker-modal club-picker--${tier}">
        <button type="button" class="club-close" aria-label="Cerrar">×</button>
        <div class="club-modal-head">
          <span class="club-eyebrow">🎁 Regalo ${T.name}</span>
          <h2>Elige tu 5 ml gratis</h2>
          <p class="club-picker-sub">${T.prize[0].toUpperCase() + T.prize.slice(1)}${tier === 'black' ? '. No incluye nicho, L’Immensité ni Sauvage Elixir.' : '.'}</p>
        </div>
        <input type="search" class="club-picker-search" placeholder="Buscar perfume o marca…" aria-label="Buscar perfume">
        <div class="club-picker-grid"></div>
      </div>`;
    document.body.appendChild(ov);
    const grid = ov.querySelector('.club-picker-grid');
    const render = q => {
      const t = (q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const list = all.filter(p => !t || `${p.brand} ${p.name}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t));
      grid.innerHTML = list.length ? list.map(p => `
        <button type="button" class="club-pick" data-id="${p.id}">
          <span class="club-pick-img">${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
          <span class="club-pick-brand">${sanitize(p.brand)}</span>
          <span class="club-pick-name">${sanitize(p.name)}</span>
          <span class="club-pick-price"><s>S/ ${Number(p.sizes['5ml']).toFixed(2)}</s> <b>GRATIS</b></span>
        </button>`).join('')
        : `<p class="club-picker-empty">${all.length ? 'No encontramos ese perfume.' : 'Por ahora no hay perfumes disponibles para este regalo. Escríbenos por WhatsApp.'}</p>`;
    };
    render('');
    const close = () => { ov.remove(); };
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('.club-close')) { close(); return; }
      const b = e.target.closest('.club-pick');
      if (!b) return;
      const p = all.find(x => String(x.id) === b.dataset.id);
      if (!p) return;
      close();
      onPick?.({ tier, productId: p.id, name: p.name, brand: p.brand, imageUrl: p.imageUrl || '' });
    });
    ov.querySelector('.club-picker-search').addEventListener('input', e => render(e.target.value));
  },

  // ─── Pantalla de "pedido enviado" ────────────────────────────────────────
  successHtml(order) {
    if (!this.enabled) return '';
    const logged = typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn();
    const gift = (order.items || []).find(i => i.clubRegalo);
    if (!logged) {
      return order.total >= CLUB_MIN ? `<div class="club-os club-os--invite">
        <span class="club-co-paw">${_CLUB_PAW}</span>
        <p>Con tu cuenta, este pedido habría sumado <strong>1 huellita</strong> del Club MICHT.</p>
        <button type="button" class="club-co-btn" data-club-os="register">Crear mi cuenta gratis</button>
      </div>` : '';
    }
    if (!this.isMember()) return '';
    if (gift) {
      return `<div class="club-os club-os--${gift.clubRegalo}"><span class="club-co-paw">${_CLUB_GIFT}</span>
        <p><strong>🎁 Tu regalo va en este pedido.</strong> Cuando confirmemos tu pago, empiezas una tarjeta ${CLUB_TIERS[gift.clubRegalo].name} nueva.</p></div>`;
    }
    const tier = this.tierFor(order.total);
    if (!tier) return `<div class="club-os"><span class="club-co-paw">${_CLUB_PAW}</span><p>Los pedidos desde S/ ${CLUB_MIN} suman huellitas en tu tarjeta del Club MICHT.</p></div>`;
    const i = this.info(tier);
    const next = Math.min(CLUB_SLOTS, i.paws + 1);
    return `<div class="club-os club-os--${tier}"><span class="club-co-paw">${_CLUB_PAW}</span>
      <p>Cuando confirmemos tu pago, sumas <strong>1 huellita ${CLUB_TIERS[tier].name}</strong> (${next}/${CLUB_SLOTS})${next >= CLUB_SLOTS ? ' y tu siguiente pedido lleva regalo 🎁' : ''}.</p>
      <button type="button" class="club-co-link" data-club-os="card">Ver mi tarjeta</button></div>`;
  },
  bindSuccess(root) {
    root.querySelector('[data-club-os="register"]')?.addEventListener('click', () => { document.getElementById('orderSuccessModal')?.classList.remove('open'); AuthModals.openRegister(); });
    root.querySelector('[data-club-os="card"]')?.addEventListener('click', () => { document.getElementById('orderSuccessModal')?.classList.remove('open'); this.open(); });
  }
};

// ─── Arranque ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('clubHomeCta')?.addEventListener('click', e => {
    const action = e.currentTarget.dataset.action;
    if (action === 'register') AuthModals.openRegister();
    else Club.open();
  });
  document.getElementById('clubHomeMore')?.addEventListener('click', () => Club.open('golden'));
  document.getElementById('clubHomeCards')?.addEventListener('click', e => {
    const card = e.target.closest('.club-card');
    if (card) Club.open(card.dataset.tier);
  });
  document.getElementById('headerClubBtn')?.addEventListener('click', () => {
    document.getElementById('headerUserDropdown')?.classList.remove('open');
    Club.open();
  });
  document.getElementById('mobileClubBtn')?.addEventListener('click', () => {
    document.getElementById('mobileMenu')?.classList.remove('open');
    document.getElementById('menuBtn')?.classList.remove('open');
    document.body.style.overflow = '';
    Club.open();
  });
  // Si UserAuth no avisa (sin Supabase), igual se averigua si el Club existe
  setTimeout(() => { if (Club.enabled === null && !Club._loading) Club.load(); }, 2500);
});
