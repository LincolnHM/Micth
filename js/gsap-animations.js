// ─── GSAP Premium Animations — MICHT Decants ─────────────────────────────────
// Plugins: GSAP core + ScrollTrigger (CDN gratuito)
// Técnicas: timelines, stagger, scrub, batch, expo ease
// Referencia: github.com/greensock/gsap-skills

(function () {
  'use strict';

  if (typeof gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);

  // ── 1. Header entrance — timeline coordinada ──────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .from('.logo',     { opacity: 0, y: -26, duration: 0.75 },         0.05)
      .from('.nav a',    { opacity: 0, y: -18, stagger: 0.08, duration: 0.55 }, 0.22)
      .from('.cart-btn', { opacity: 0, scale: 0.65, duration: 0.45 },     0.42)
      .from('.menu-btn', { opacity: 0, scale: 0.65, duration: 0.45 },     0.48);
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

  // ── 3. Product cards: batch reveal con MutationObserver ──────────────────
  (function initProductCards() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    function animateNewCards() {
      const cards = grid.querySelectorAll('.product-card:not([data-gsap])');
      if (!cards.length) return;
      cards.forEach(el => el.setAttribute('data-gsap', '1'));

      gsap.fromTo(
        cards,
        { opacity: 0, y: 48, scale: 0.93 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.68,
          ease: 'power3.out',
          stagger: { each: 0.07, from: 'start' },
          // Limpia inline styles para que el hover CSS funcione correctamente
          onComplete() { gsap.set(cards, { clearProps: 'transform,opacity,scale' }); },
        }
      );

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
    y: 90,
    scale: 0.87,
    duration: 1.15,
    ease: 'expo.out',
  });

  gsap.from('.contact-label, .contact-title, .contact-sub, .btn-wa-contact', {
    scrollTrigger: {
      trigger: '.contact-section',
      start: 'top 72%',
      toggleActions: 'play none none none',
    },
    opacity: 0,
    y: 24,
    duration: 0.65,
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
    y: 30,
    duration: 0.65,
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

  // ── 9. Scroll progress line — color dorado pulsante ──────────────────────
  // (el ancho ya lo maneja animations.js via JS; aquí solo la apariencia)
  const progressEl = document.querySelector('.scroll-progress-line');
  if (progressEl) {
    ScrollTrigger.create({
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: self => {
        const glow = self.progress > 0.05 ? '0 0 6px rgba(201,168,76,.5)' : 'none';
        progressEl.style.boxShadow = glow;
      },
    });
  }

})();
