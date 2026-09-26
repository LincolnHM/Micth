(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile       = () => window.innerWidth < 768;
  // Tilt y brillos solo con mouse real: tablets y laptops táctiles no los necesitan
  const canHover       = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ─── Barra de progreso de scroll ─────────────────────────
  const progressLine = document.createElement('div');
  progressLine.className = 'scroll-progress-line';
  document.body.prepend(progressLine);

  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    // scaleX en vez de width: no recalcula el layout y va fluido en celulares
    progressLine.style.transform = `scaleX(${pct})`;
  }

  // ─── Sistema parallax ─────────────────────────────────────
  // Capas registradas: { el, speed, axis, baseY }
  const parallaxItems = [];

  function registerParallax(selector, speed, axis = 'y') {
    document.querySelectorAll(selector).forEach(el => {
      parallaxItems.push({ el, speed, axis });
    });
  }

  function applyParallax() {
    if (prefersReduced) return;
    const y = window.scrollY;

    parallaxItems.forEach(({ el, speed, axis }) => {
      const rect = el.getBoundingClientRect();
      const vh   = window.innerHeight;
      // Solo animar si el elemento está cerca del viewport
      if (rect.bottom < -vh || rect.top > vh * 2) return;

      const shift = y * speed;
      if (axis === 'y') {
        el.style.transform = `translateY(${shift}px)`;
      } else {
        el.style.transform = `translateX(${shift}px)`;
      }
    });
  }

  // ─── Parallax de blobs ────────────────────────────────────
  // Aplicamos el parallax al contenedor bg-blobs (no a los blobs individuales
  // que ya usan transform en su animación CSS blobFloat)
  let bgBlobsEl = null;

  function initBlobParallax() {
    bgBlobsEl = document.querySelector('.bg-blobs');
  }

  function updateBlobParallax() {
    if (!bgBlobsEl || prefersReduced || isMobile()) return;
    const y = window.scrollY;
    bgBlobsEl.style.transform = `translateY(${y * 0.06}px)`;
  }

  // ─── Parallax del carousel (hero) ────────────────────────
  let carouselTrack = null;

  function updateCarouselParallax() {
    if (!carouselTrack || prefersReduced || isMobile()) return;
    const y     = window.scrollY;
    const limit = (carouselTrack.parentElement?.offsetHeight || 800) * 1.4;
    if (y < limit) {
      carouselTrack.style.transform = `translateY(${y * 0.22}px)`;
    }
  }

  // ─── Parallax de la mascota ───────────────────────────────
  let mascot = null;

  function updateMascotParallax() {
    if (!mascot || prefersReduced || isMobile()) return;
    const y     = window.scrollY;
    const limit = window.innerHeight * 1.5;
    if (y < limit) {
      mascot.style.transform = `translateY(${y * -0.14}px)`;
    }
  }

  // Las partículas usan solo su animación CSS (particleFloat)
  // No aplicamos transform de scroll a la capa fixed para evitar gaps visuales

  // ─── Parallax sección contacto ────────────────────────────
  let contactSection = null;

  function updateContactParallax() {
    if (!contactSection || prefersReduced) return;
    const rect  = contactSection.getBoundingClientRect();
    const vh    = window.innerHeight;
    if (rect.top > vh || rect.bottom < 0) return;
    const progress = (vh - rect.top) / (vh + rect.height);
    const shift    = (progress - 0.5) * 40;
    contactSection.style.backgroundPositionY = `calc(50% + ${shift}px)`;
  }

  // ─── Decoradores flotantes de sección ────────────────────
  let sectionDecos = [];

  function initSectionDecos() {
    document.querySelectorAll('.parallax-deco').forEach((el, i) => {
      const speed = i % 2 === 0 ? 0.06 : -0.06;
      sectionDecos.push({ el, speed });
    });
  }

  function updateSectionDecos() {
    if (prefersReduced || isMobile()) return;
    const y = window.scrollY;
    sectionDecos.forEach(({ el, speed }) => {
      const rect = el.getBoundingClientRect();
      const vh   = window.innerHeight;
      if (rect.bottom < -vh || rect.top > vh * 2) return;
      el.style.transform = `translateY(${y * speed}px)`;
    });
  }

  // ─── Efecto tilt en tarjetas de producto (hover) ─────────
  let tiltReady = false;

  function initCardTilt() {
    if (tiltReady || prefersReduced || !canHover.matches) return;
    tiltReady = true;

    let pending = null;
    let tiltFrame = 0;

    function resetTilt(except) {
      document.querySelectorAll('.product-card.tilted').forEach(c => {
        if (c === except) return;
        c.style.transform = '';
        c.classList.remove('tilted');
      });
    }

    function applyTilt() {
      tiltFrame = 0;
      const e = pending;
      if (!e) return;
      const card = e.target.closest ? e.target.closest('.product-card') : null;
      resetTilt(card);
      if (!card || !canHover.matches) return;

      const rect = card.getBoundingClientRect();
      const dx   = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2);
      const dy   = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2);
      card.style.transform = `perspective(800px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg) translateZ(4px)`;
      card.classList.add('tilted');

      // Coordenadas locales para el brillo reflectivo
      card.style.setProperty('--x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--y', `${e.clientY - rect.top}px`);
    }

    // Un cálculo por frame como máximo (antes corría en cada píxel del mouse)
    document.addEventListener('mousemove', e => {
      pending = e;
      if (!tiltFrame) tiltFrame = requestAnimationFrame(applyTilt);
    }, { passive: true });

    document.addEventListener('mouseleave', () => resetTilt(null), true);
    // Si se conecta/desconecta un mouse (tablet con teclado), limpiar el efecto
    canHover.addEventListener?.('change', () => { if (!canHover.matches) resetTilt(null); });
  }

  // ─── Loop RAF unificado ───────────────────────────────────
  let ticking = false;

  function onScroll() {
    updateProgress();
    if (!ticking) {
      requestAnimationFrame(() => {
        updateCarouselParallax();
        updateMascotParallax();
        updateBlobParallax();
        updateContactParallax();
        updateSectionDecos();
        applyParallax();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // Al girar el celular o cambiar el tamaño de la ventana, recalcular posiciones
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(onScroll, 150));

  // ─── Partículas doradas ───────────────────────────────────
  function createParticles() {
    const container = document.getElementById('parallax-particles');
    if (!container || prefersReduced) return;

    const count = isMobile() ? 8 : 18;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'parallax-particle';
      const size = 2 + Math.random() * 3;
      const x    = Math.random() * 100;
      const y    = Math.random() * 100;
      const dur  = 6 + Math.random() * 8;
      const delay = Math.random() * -10;
      dot.style.cssText = `
        left:${x}%;
        top:${y}%;
        width:${size}px;
        height:${size}px;
        animation-duration:${dur}s;
        animation-delay:${delay}s;
        opacity:${0.25 + Math.random() * 0.45};
      `;
      container.appendChild(dot);
    }
  }

  // ─── Animación reveal al hacer scroll ────────────────────
  function initRevealOnScroll() {
    const revealEls = document.querySelectorAll('.reveal-on-scroll');
    if (!revealEls.length) return;

    // Navegadores sin IntersectionObserver o sin animaciones: mostrar todo de una vez
    if (prefersReduced || !('IntersectionObserver' in window)) {
      revealEls.forEach(el => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      // En celular los elementos son altos: umbral bajo y un margen para que aparezcan antes
      threshold: isMobile() ? 0.05 : 0.12,
      rootMargin: '0px 0px -6% 0px',
    });

    revealEls.forEach(el => observer.observe(el));
  }

  // ─── Init ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    carouselTrack   = document.querySelector('.carousel-track');
    mascot          = document.querySelector('.mascot-img');
    contactSection  = document.querySelector('.contact-section');

    initBlobParallax();
    initSectionDecos();
    createParticles();
    initRevealOnScroll();
    // Asegurar que bg-blobs no interfiera con la posición fixed
    if (bgBlobsEl) bgBlobsEl.style.willChange = 'transform';

    // Init card tilt after a short delay (productos se renderizan dinámicamente)
    setTimeout(initCardTilt, 800);
    canHover.addEventListener?.('change', initCardTilt);

    updateProgress();
    onScroll();
  });
})();
