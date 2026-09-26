// ─── GSAP Premium Animations — MICHT Decants ─────────────────────────────────
// Plugins: GSAP core + ScrollTrigger (CDN gratuito)
// Técnicas: timelines, stagger, scrub, batch, expo ease
// Referencia: github.com/greensock/gsap-skills

(function () {
  'use strict';

  if (typeof gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);

  // En celular los recorridos son más cortos y rápidos: se sienten ágiles y no
  // “saltan” en pantallas pequeñas. En computadora se mantiene el efecto amplio.
  const mobile = () => window.matchMedia('(max-width: 767px)').matches;
  const dist   = px => (mobile() ? Math.round(px * 0.5) : px);
  const dur    = s  => (mobile() ? +(s * 0.8).toFixed(2) : s);

  // Evita saltos cuando la barra del navegador del celular aparece/desaparece
  ScrollTrigger.config({ ignoreMobileResize: true });

  // ── 1. Header entrance ────────────────────────────────────────────────────
  // El logo y los links del menú ya entran con CSS (logoSlideIn / navFadeIn);
  // animarlos también aquí hacía que ambas animaciones se pelearan.
  document.addEventListener('DOMContentLoaded', () => {
    gsap.from('.header-right > .cart-btn, .header-right > .menu-btn', {
      opacity: 0, scale: 0.65, duration: 0.45, ease: 'power4.out', stagger: 0.06, delay: 0.4,
    });
  });

  // ── 2. Parallax scrub en mascota — ligada al scroll ───────────────────────
  if (window.matchMedia('(min-width: 721px)').matches) {
    gsap.to('.hero-mascot', {
      y: -55,
      ease: 'none',
      scrollTrigger: {
        trigger: '#carouselWrapper',
        start: 'top top',
        end: 'bottom top',
        scrub: 1.8,
      },
    });
  }

  // ── 3. Product cards: aparecen al entrar en pantalla ─────────────────────
  // Antes se animaban todas a la vez al cargar; en celular las de más abajo
  // terminaban su animación antes de verse. Ahora cada fila aparece al llegar.
  (function initProductCards() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    function animateNewCards() {
      const cards = grid.querySelectorAll('.product-card:not([data-gsap])');
      if (!cards.length) return;
      cards.forEach(el => el.setAttribute('data-gsap', '1'));

      // Limpiar triggers de tarjetas que ya no existen (filtros, paginación)
      ScrollTrigger.getAll().forEach(t => {
        if (t.vars && t.vars.id === 'card-batch' && t.trigger && !t.trigger.isConnected) t.kill();
      });

      gsap.set(cards, { opacity: 0, y: dist(48), scale: 0.95 });

      ScrollTrigger.batch(cards, {
        id: 'card-batch',
        start: 'top 94%',
        once: true,
        onEnter: batch => gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: dur(0.62),
          ease: 'power3.out',
          stagger: { each: mobile() ? 0.05 : 0.07, from: 'start' },
          overwrite: true,
          // Limpia inline styles para que el hover CSS funcione correctamente
          onComplete() { gsap.set(batch, { clearProps: 'transform,opacity,scale' }); },
        }),
      });

      ScrollTrigger.refresh();
    }

    // MutationObserver para filtros y paginación
    let debounce;
    new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(animateNewCards, 65);
    }).observe(grid, { childList: true });

    // Primera carga desde Supabase
    document.addEventListener('catalogLoaded', () => setTimeout(animateNewCards, 85));
  })();

  // ── 5. Marquee strip ─────────────────────────────────────────────────────
  const marqueeEl = document.querySelector('.marquee-strip');
  if (marqueeEl) {
    gsap.from(marqueeEl, {
      scrollTrigger: { trigger: marqueeEl, start: 'top 95%' },
      opacity: 0,
      duration: 0.9,
      ease: 'power2.out',
    });
  }

  // ── 6. Contact card — entrada dramática ──────────────────────────────────
  gsap.from('.contact-card', {
    scrollTrigger: {
      trigger: '.contact-section',
      start: 'top 78%',
      toggleActions: 'play none none none',
    },
    opacity: 0,
    y: dist(90),
    scale: mobile() ? 0.95 : 0.87,
    duration: dur(1.15),
    ease: 'expo.out',
  });

  gsap.from('.contact-label, .contact-title, .contact-sub, .btn-wa-contact', {
    scrollTrigger: {
      trigger: '.contact-section',
      start: 'top 72%',
      toggleActions: 'play none none none',
    },
    opacity: 0,
    y: dist(24),
    duration: dur(0.65),
    ease: 'power3.out',
    stagger: 0.1,
  });

  // ── 7. Footer ─────────────────────────────────────────────────────────────
  gsap.from('.footer-logo, .footer > p, .footer > a', {
    scrollTrigger: {
      trigger: '.footer',
      start: 'top 93%',
      toggleActions: 'play none none none',
    },
    opacity: 0,
    y: dist(30),
    duration: dur(0.65),
    ease: 'power3.out',
    stagger: 0.12,
  });

  // ── 8. Social icons — pop con back ease ───────────────────────────────────
  gsap.from('.social-item', {
    scrollTrigger: {
      trigger: '.social-list',
      start: 'top 96%',
      toggleActions: 'play none none none',
    },
    opacity: 0,
    scale: 0.5,
    y: 20,
    duration: 0.55,
    ease: 'back.out(1.8)',
    stagger: 0.1,
  });

  // Al girar el celular, recalcular dónde empiezan las animaciones
  window.addEventListener('orientationchange', () => setTimeout(() => ScrollTrigger.refresh(), 250));

  // ── 9. Scroll progress line — color dorado pulsante ──────────────────────
  // (el ancho ya lo maneja animations.js via JS; aquí solo la apariencia)
  const progressEl = document.querySelector('.scroll-progress-line');
  if (progressEl) {
    ScrollTrigger.create({
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: self => {
        const glow = self.progress > 0.05 ? '0 0 6px rgba(124,79,176,.5)' : 'none';
        progressEl.style.boxShadow = glow;
      },
    });
  }

})();
