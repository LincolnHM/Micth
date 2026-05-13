(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Barra de progreso de scroll ─────────────────────────
  const progressLine = document.createElement('div');
  progressLine.className = 'scroll-progress-line';
  document.body.prepend(progressLine);

  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressLine.style.width = max > 0 ? (window.scrollY / max * 100) + '%' : '0%';
  }

  // ─── Parallax suave en el carousel (solo desktop) ────────
  let carouselTrack = null;

  function updateParallax() {
    if (!carouselTrack || prefersReduced || window.innerWidth < 768) return;
    const y = window.scrollY;
    const limit = carouselTrack.parentElement?.offsetHeight * 1.4 || 800;
    if (y < limit) {
      carouselTrack.style.transform = `translateY(${y * 0.18}px)`;
    }
  }

  window.addEventListener('scroll', () => {
    updateProgress();
    updateParallax();
  }, { passive: true });

  // ─── Scroll reveal con stagger ───────────────────────────
  function initReveal() {
    if (prefersReduced) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('anim-visible');
        io.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.filters-section, #contacto, .footer').forEach(el => {
      el.classList.add('anim-fade-up');
      io.observe(el);
    });

    function observeCards() {
      document.querySelectorAll('#productsGrid .product-card:not([data-anim])').forEach((card, i) => {
        card.setAttribute('data-anim', '1');
        card.classList.add('anim-scale');
        card.style.transitionDelay = `${Math.min(i % 4, 3) * 90}ms`;
        io.observe(card);
      });
    }

    const grid = document.getElementById('productsGrid');
    if (grid) new MutationObserver(observeCards).observe(grid, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    carouselTrack = document.querySelector('.carousel-track');
    updateProgress();
    initReveal();
  });
})();
