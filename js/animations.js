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
    const limit = (carouselTrack.parentElement?.offsetHeight || 800) * 1.4;
    if (y < limit) {
      carouselTrack.style.transform = `translateY(${y * 0.18}px)`;
    }
  }

  window.addEventListener('scroll', () => {
    updateProgress();
    updateParallax();
  }, { passive: true });

  document.addEventListener('DOMContentLoaded', () => {
    carouselTrack = document.querySelector('.carousel-track');
    updateProgress();
  });
})();
