// ─── Hero Carousel ─────────────────────────────────────────────────────────────
// Auto-rotate · Flechas · Dots · Swipe táctil · Pausa en hover

const Carousel = {
  current:   0,
  total:     0,
  timer:     null,
  INTERVAL:  5000,

  slides: [
    {
      tag:      'NUEVA COLECCIÓN',
      title:    'El Lujo que mereces,\nen cada gota',
      subtitle: 'Decants auténticos de las mejores casas de perfumería árabe y de diseñador del mundo.',
      cta:      { text: 'Explorar Catálogo', href: '#catalogo' },
      theme:    'slide-1'
    },
    {
      tag:      'PERFUMES ÁRABES',
      title:    'Misterio Oriental.\nAura Inconfundible.',
      subtitle: 'Oud puro, rosa de Damasco y ámbar sagrado. Las fragancias más codiciadas de Medio Oriente.',
      cta:      { text: 'Ver Árabes', href: '#catalogo', filter: 'arabe' },
      theme:    'slide-2'
    },
    {
      tag:      'ENVÍOS A TODO PERÚ',
      title:    'Desde Soritor\na todo el Perú.',
      subtitle: 'Envíos seguros vía Shalom a cualquier ciudad del país. Recojo en tienda disponible también.',
      cta:      { text: 'Hacer Pedido', href: '#catalogo' },
      theme:    'slide-3'
    }
  ],

  init() {
    const wrapper = document.getElementById('carouselWrapper');
    if (!wrapper) return;

    this.total = this.slides.length;
    this.render(wrapper);
    this.startTimer();
    this.initSwipe(wrapper);
  },

  render(wrapper) {
    // Slides
    const track = wrapper.querySelector('.carousel-track');
    track.innerHTML = this.slides.map((s, i) => `
      <div class="carousel-slide ${s.theme} ${i === 0 ? 'active' : ''}" role="listitem">
        <div class="carousel-content">
          <span class="carousel-tag">${s.tag}</span>
          <h2 class="carousel-title">${s.title.replace('\n', '<br>')}</h2>
          <p class="carousel-sub">${s.subtitle}</p>
          <a href="${s.cta.href}" class="carousel-cta" ${s.cta.filter ? `data-filter="${s.cta.filter}"` : ''}>
            ${s.cta.text}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </a>
        </div>
        <div class="carousel-deco" aria-hidden="true">
          <div class="deco-ring deco-ring-1"></div>
          <div class="deco-ring deco-ring-2"></div>
          <div class="deco-ring deco-ring-3"></div>
          ${i === 0 ? '<div class="deco-bottle"></div>' : ''}
        </div>
      </div>
    `).join('');

    // Dots
    const dots = wrapper.querySelector('.carousel-dots');
    dots.innerHTML = this.slides.map((_, i) => `
      <button class="dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>
    `).join('');

    // Event listeners
    wrapper.querySelector('.carousel-prev').addEventListener('click', () => this.prev());
    wrapper.querySelector('.carousel-next').addEventListener('click', () => this.next());
    dots.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', () => this.goTo(parseInt(dot.dataset.index)));
    });

    // CTA links que activan filtros
    track.querySelectorAll('.carousel-cta[data-filter]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const filter = a.dataset.filter;
        // Activar el filtro correspondiente en el catálogo
        const btn = document.querySelector(`.filter-btn[data-filter="${filter}"]`);
        if (btn) { btn.click(); }
        document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Actualizar total dinámico
    const totalEl = document.getElementById('slideTotalNum');
    if (totalEl) totalEl.textContent = String(this.total).padStart(2, '0');

    // Pausa al hover
    wrapper.addEventListener('mouseenter', () => this.stopTimer());
    wrapper.addEventListener('mouseleave', () => this.startTimer());
  },

  goTo(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots   = document.querySelectorAll('.dot');
    if (!slides.length) return;

    slides[this.current].classList.remove('active');
    dots[this.current].classList.remove('active');

    this.current = (index + this.total) % this.total;

    slides[this.current].classList.add('active');
    dots[this.current].classList.add('active');

    // Actualizar contador
    const counterEl = document.getElementById('slideCurrentNum');
    if (counterEl) counterEl.textContent = String(this.current + 1).padStart(2, '0');

    // Reiniciar barra de progreso
    if (this.timer) this.resetProgress();
  },

  resetProgress() {
    const bar = document.getElementById('carouselProgressBar');
    if (!bar) return;
    const parent = bar.parentElement;
    parent.removeChild(bar);
    const newBar = bar.cloneNode(true);
    parent.appendChild(newBar);
  },

  next() { this.goTo(this.current + 1); },
  prev() { this.goTo(this.current - 1); },

  startTimer() {
    this.stopTimer();
    this.resetProgress();
    this.timer = setInterval(() => this.next(), this.INTERVAL);
  },

  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  },

  // ─── Soporte de swipe táctil ──────────────────────────────────────────────

  initSwipe(wrapper) {
    let startX = 0;
    let isDragging = false;

    wrapper.addEventListener('touchstart', e => {
      startX    = e.touches[0].clientX;
      isDragging = true;
    }, { passive: true });

    wrapper.addEventListener('touchend', e => {
      if (!isDragging) return;
      isDragging = false;
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? this.next() : this.prev();
      }
    }, { passive: true });
  }
};

document.addEventListener('DOMContentLoaded', () => Carousel.init());
