(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile       = () => window.innerWidth < 768;

  // ─── Barra de progreso de scroll ─────────────────────────
  const progressLine = document.createElement('div');
  progressLine.className = 'scroll-progress-line';
  document.body.prepend(progressLine);

  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressLine.style.width = max > 0 ? (window.scrollY / max * 100) + '%' : '0%';
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
  function initCardTilt() {
    if (prefersReduced || isMobile()) return;

    document.addEventListener('mousemove', e => {
      const card = e.target.closest('.product-card');
      if (!card) {
        // Resetear todas las tarjetas sin hover
        document.querySelectorAll('.product-card.tilted').forEach(c => {
          c.style.transform = '';
          c.classList.remove('tilted');
        });
        return;
      }
      const rect   = card.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const dx     = (e.clientX - cx) / (rect.width  / 2);
      const dy     = (e.clientY - cy) / (rect.height / 2);
      const rx     = -dy * 4;
      const ry     =  dx * 4;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(4px)`;
      card.classList.add('tilted');

      // Coordenadas locales para el brillo reflectivo
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
    });

    document.addEventListener('mouseleave', () => {
      document.querySelectorAll('.product-card.tilted').forEach(c => {
        c.style.transform = '';
        c.classList.remove('tilted');
      });
    }, true);
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

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

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

    updateProgress();
    onScroll();
  });
})();
