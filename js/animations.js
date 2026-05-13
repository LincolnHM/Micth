(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('anim-visible');
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  function observeStatic() {
    document.querySelectorAll('.filters-section, #contacto, .footer').forEach(el => {
      el.classList.add('anim-fade-up');
      io.observe(el);
    });
  }

  function observeCards() {
    document.querySelectorAll('#productsGrid .product-card:not([data-anim])').forEach((card, i) => {
      card.setAttribute('data-anim', '1');
      card.classList.add('anim-scale');
      card.style.transitionDelay = `${Math.min(i % 4, 3) * 90}ms`;
      io.observe(card);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    observeStatic();
    const grid = document.getElementById('productsGrid');
    if (grid) {
      new MutationObserver(observeCards).observe(grid, { childList: true });
    }
  });
})();
