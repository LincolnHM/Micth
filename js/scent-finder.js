(function () {
  'use strict';

  // ─── Estado global del visor de Historias ───────────────
  const stories = {
    unboxing: [
      {
        title: "Unboxing Premium ✨",
        text: "Cada pedido de MICHT es una experiencia de lujo. Cajas acolchadas con viruta de madera aromática, tarjetas de agradecimiento personalizadas y muestras de regalo en compras seleccionadas.",
        img: "imgGato/web.png",
        icon: "🎁"
      },
      {
        title: "Empaque Seguro 🛡️",
        text: "Sellamos al vacío cada decant y los protegemos con triple capa de burbuja para asegurar que tu fragancia llegue intacta y lista para atomizar.",
        img: "imgGato/1.jpeg",
        icon: "📦"
      }
    ],
    calidad: [
      {
        title: "Extracción Directa 🧪",
        text: "Garantía de originalidad 100%. Extraemos el líquido directamente del frasco original utilizando jeringas estériles en un laboratorio limpio.",
        img: "imgGato/22eecf2b-7e14-4402-89f9-5bc64afa1b58.png",
        icon: "🔬"
      },
      {
        title: "Frasco Auténtico 💯",
        text: "No compramos réplicas ni diluimos el perfume. Cada lote es inspeccionado y certificado antes de ingresar a nuestro catálogo.",
        img: "imgGato/web.png",
        icon: "✅"
      }
    ],
    envios: [
      {
        title: "Envíos a Todo el Perú 🇵🇪",
        text: "Despachamos diariamente vía Olva Courier y Shalom. Recibe en Lima en 24-48 horas, y en provincias en 2-4 días hábiles.",
        img: "imgGato/WhatsApp Image 2026-05-23 at 5.07.48 PM.jpeg",
        icon: "🚚"
      },
      {
        title: "Seguimiento En Vivo 🗺️",
        text: "Te enviamos tu número de remito o código de seguimiento por WhatsApp para que rastrees tu pedido en tiempo real.",
        img: "imgGato/web.png",
        icon: "📱"
      }
    ],
    gato: [
      {
        title: "Mascota MICHT 🐾",
        text: "Te presentamos a Michty, nuestro asistente estrella de empaquetado. Supervisa que todas las cajas tengan suficiente amor antes de salir.",
        img: "imgGato/gato-removebg-preview.png",
        icon: "🐈"
      },
      {
        title: "Control de Calidad 😂",
        text: "En realidad prefiere dormir dentro de las cajas vacías, ¡pero nos inspira a ofrecer el servicio más cariñoso de todo el país!",
        img: "imgGato/gato-removebg-preview.png",
        icon: "💖"
      }
    ]
  };

  let activeStoryKey = null;
  let activeSlideIdx = 0;
  let storyTimer = null;
  let storyStartTime = 0;
  let storyPausedTime = 0;
  let isStoryPaused = false;
  const STORY_DURATION = 5000; // 5 segundos por historia

  // ─── Inicialización de Historias ─────────────────────────
  function initStories() {
    const storyItems = document.querySelectorAll('.story-item');
    const modal = document.getElementById('storiesModal');
    if (!modal) return;

    storyItems.forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.story;
        if (stories[key]) {
          openStoryViewer(key);
        }
      });
    });

    modal.querySelector('.stories-modal-close').addEventListener('click', closeStoryViewer);
    modal.querySelector('.stories-click-left').addEventListener('click', prevStorySlide);
    modal.querySelector('.stories-click-right').addEventListener('click', nextStorySlide);

    // Pausar al presionar y reanudar al soltar
    const panel = modal.querySelector('.stories-modal-panel');
    panel.addEventListener('mousedown', pauseStory);
    panel.addEventListener('mouseup', resumeStory);
    panel.addEventListener('touchstart', pauseStory, { passive: true });
    panel.addEventListener('touchend', resumeStory, { passive: true });
  }

  function openStoryViewer(key) {
    activeStoryKey = key;
    activeSlideIdx = 0;
    const modal = document.getElementById('storiesModal');
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Ocultar chat si estuviera abierto
    document.getElementById('chatbotWrapper')?.style.setProperty('z-index', '1');

    renderStorySlide();
  }

  function renderStorySlide() {
    const modal = document.getElementById('storiesModal');
    if (!modal || !activeStoryKey) return;

    const slides = stories[activeStoryKey];
    const slide = slides[activeSlideIdx];

    // Renderizar barras de progreso superiores
    const progressContainer = modal.querySelector('.stories-progress-bars');
    progressContainer.innerHTML = slides.map((_, idx) => `
      <div class="story-progress-track">
        <div class="story-progress-fill" style="width: ${idx < activeSlideIdx ? '100%' : '0%'}"></div>
      </div>
    `).join('');

    // Actualizar contenido del slide
    const imgEl = document.getElementById('storyImg');
    const titleEl = document.getElementById('storyTitle');
    const textEl = document.getElementById('storyText');
    const iconEl = document.getElementById('storyIcon');

    if (imgEl) {
      imgEl.src = slide.img;
      imgEl.alt = slide.title;
      imgEl.onerror = () => { imgEl.src = 'imgGato/web.png'; };
    }
    if (titleEl) titleEl.textContent = slide.title;
    if (textEl) textEl.textContent = slide.text;
    if (iconEl) iconEl.textContent = slide.icon;

    // Animar entrada del slide
    if (window.gsap) {
      window.gsap.fromTo('.stories-content-overlay', 
        { opacity: 0, y: 15 }, 
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
      window.gsap.fromTo('#storyImg',
        { scale: 1.05 },
        { scale: 1, duration: 5, ease: "linear" }
      );
    }

    startStoryTimer();
  }

  function startStoryTimer() {
    clearTimeout(storyTimer);
    isStoryPaused = false;
    storyStartTime = Date.now();
    storyPausedTime = 0;

    const modal = document.getElementById('storiesModal');
    if (!modal) return;
    const fillBar = modal.querySelectorAll('.story-progress-fill')[activeSlideIdx];

    if (window.gsap) {
      window.gsap.killTweensOf(fillBar);
      window.gsap.fromTo(fillBar, 
        { width: '0%' }, 
        { width: '100%', duration: STORY_DURATION / 1000, ease: "none", onComplete: nextStorySlide }
      );
    } else {
      let w = 0;
      const step = () => {
        if (isStoryPaused) return;
        w += 100 / (STORY_DURATION / 30);
        if (fillBar) fillBar.style.width = Math.min(w, 100) + '%';
        if (w >= 100) {
          nextStorySlide();
        } else {
          storyTimer = setTimeout(step, 30);
        }
      };
      storyTimer = setTimeout(step, 30);
    }
  }

  function pauseStory() {
    isStoryPaused = true;
    storyPausedTime = Date.now() - storyStartTime;
    const modal = document.getElementById('storiesModal');
    if (!modal) return;
    const fillBar = modal.querySelectorAll('.story-progress-fill')[activeSlideIdx];
    if (window.gsap && fillBar) {
      window.gsap.killTweensOf(fillBar);
    } else {
      clearTimeout(storyTimer);
    }
  }

  function resumeStory() {
    if (!isStoryPaused) return;
    isStoryPaused = false;
    storyStartTime = Date.now() - storyPausedTime;

    const modal = document.getElementById('storiesModal');
    if (!modal) return;
    const fillBar = modal.querySelectorAll('.story-progress-fill')[activeSlideIdx];
    const remainingTime = STORY_DURATION - storyPausedTime;

    if (remainingTime <= 0) {
      nextStorySlide();
      return;
    }

    if (window.gsap && fillBar) {
      const curWidthPercent = parseFloat(fillBar.style.width) || (storyPausedTime / STORY_DURATION * 100);
      window.gsap.fromTo(fillBar, 
        { width: curWidthPercent + '%' }, 
        { width: '100%', duration: remainingTime / 1000, ease: "none", onComplete: nextStorySlide }
      );
    } else {
      let w = (storyPausedTime / STORY_DURATION) * 100;
      const step = () => {
        if (isStoryPaused) return;
        w += 100 / (STORY_DURATION / 30);
        if (fillBar) fillBar.style.width = Math.min(w, 100) + '%';
        if (w >= 100) {
          nextStorySlide();
        } else {
          storyTimer = setTimeout(step, 30);
        }
      };
      storyTimer = setTimeout(step, 30);
    }
  }

  function nextStorySlide() {
    const slides = stories[activeStoryKey];
    if (!slides) return;

    if (activeSlideIdx < slides.length - 1) {
      activeSlideIdx++;
      renderStorySlide();
    } else {
      closeStoryViewer();
    }
  }

  function prevStorySlide() {
    if (activeSlideIdx > 0) {
      activeSlideIdx--;
      renderStorySlide();
    } else {
      // Si estamos en la primera historia de la sección, reiniciarla
      renderStorySlide();
    }
  }

  function closeStoryViewer() {
    clearTimeout(storyTimer);
    const modal = document.getElementById('storiesModal');
    if (!modal) return;

    const fillBars = modal.querySelectorAll('.story-progress-fill');
    if (window.gsap) {
      fillBars.forEach(b => window.gsap.killTweensOf(b));
    }

    modal.classList.remove('open');
    document.body.style.overflow = '';
    activeStoryKey = null;

    document.getElementById('chatbotWrapper')?.style.setProperty('z-index', '9999');
  }


  // ─── Estado global del Scent Finder ──────────────────────
  let scentStep = 1;
  const scentAnswers = {
    gender: null,
    vibe: null,
    note: null
  };

  // ─── Inicialización del Scent Finder ──────────────────────
  function initScentFinder() {
    const bannerBtn = document.getElementById('startScentFinderBtn');
    const modal = document.getElementById('scentFinderModal');
    if (!modal) return;

    bannerBtn?.addEventListener('click', openScentFinder);
    modal.querySelector('.scent-modal-close').addEventListener('click', closeScentFinder);

    // Botones de respuesta del cuestionario
    modal.querySelectorAll('.scent-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step);
        const val = btn.dataset.value;

        if (step === 1) {
          scentAnswers.gender = val;
          goToScentStep(2);
        } else if (step === 2) {
          scentAnswers.vibe = val;
          goToScentStep(3);
        } else if (step === 3) {
          scentAnswers.note = val;
          calculateScentResults();
        }
      });
    });

    // Botón reiniciar
    document.getElementById('scentRestartBtn')?.addEventListener('click', () => {
      openScentFinder();
    });
  }

  function openScentFinder() {
    scentStep = 1;
    scentAnswers.gender = null;
    scentAnswers.vibe = null;
    scentAnswers.note = null;

    const modal = document.getElementById('scentFinderModal');
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('chatbotWrapper')?.style.setProperty('z-index', '1');

    goToScentStep(1);
  }

  function goToScentStep(step) {
    scentStep = step;
    const modal = document.getElementById('scentFinderModal');
    if (!modal) return;

    // Actualizar indicador de paso
    const indicator = modal.querySelector('.scent-step-indicator');
    if (indicator) {
      if (step <= 3) {
        indicator.style.display = 'block';
        indicator.textContent = `Paso ${step} de 3`;
      } else {
        indicator.style.display = 'none';
      }
    }

    // Ocultar todos los paneles y mostrar el activo
    modal.querySelectorAll('.scent-step-panel').forEach(panel => {
      panel.style.display = 'none';
    });

    const activePanel = modal.querySelector(`.scent-step-panel[data-step="${step}"]`);
    if (activePanel) {
      activePanel.style.display = 'block';

      // Animaciones GSAP de entrada de las opciones
      if (window.gsap) {
        window.gsap.fromTo(activePanel.querySelectorAll('.scent-option-btn, .scent-results-container, .scent-success-header'),
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" }
        );
      }
    }
  }

  function closeScentFinder() {
    const modal = document.getElementById('scentFinderModal');
    if (!modal) return;

    modal.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('chatbotWrapper')?.style.setProperty('z-index', '9999');
  }

  function calculateScentResults() {
    goToScentStep(4); // Carga / Resultados
    const resultsContainer = document.getElementById('scentResultsList');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="scent-loader-wrap">
        <div class="scent-spinner"></div>
        <p>Destilando fragancias perfectas para ti...</p>
      </div>
    `;

    setTimeout(() => {
      // Traer todos los productos
      const allProducts = window.CloudProducts?.productsCache || [];
      if (!allProducts.length) {
        resultsContainer.innerHTML = `<p style="text-align:center;color:var(--text3)">No se encontraron productos disponibles en caché.</p>`;
        return;
      }

      // Filtrar y calificar
      const scored = allProducts.map(p => {
        let score = 0;

        // 1. Género
        if (scentAnswers.gender === 'hombre') {
          if (p.gender === 'hombre') score += 10;
          else if (p.gender === 'unisex') score += 5;
        } else if (scentAnswers.gender === 'mujer') {
          if (p.gender === 'mujer') score += 10;
          else if (p.gender === 'unisex') score += 5;
        } else { // unisex
          if (p.gender === 'unisex') score += 10;
          else score += 3;
        }

        // 2. Vibra
        const olf = (p.olfFamily || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        if (scentAnswers.vibe === 'fresco') {
          if (p.occasion === 'dia') score += 5;
          if (olf.includes('cítrico') || olf.includes('fresco') || olf.includes('acuático') || olf.includes('aromático')) score += 8;
        } else if (scentAnswers.vibe === 'elegante') {
          if (p.occasion === 'dia' || p.occasion === 'ambas') score += 5;
          if (olf.includes('amaderado') || olf.includes('fougere') || olf.includes('chipre')) score += 8;
        } else if (scentAnswers.vibe === 'nocturno') {
          if (p.occasion === 'noche' || p.occasion === 'ambas') score += 7;
          if (olf.includes('ámbar') || olf.includes('especiado') || olf.includes('dulce') || olf.includes('oriental')) score += 8;
        } else { // casual
          if (p.occasion === 'dia' || p.occasion === 'ambas') score += 6;
          if (olf.includes('almizcle') || olf.includes('frutal') || olf.includes('floral')) score += 5;
        }

        // 3. Notas
        if (scentAnswers.note === 'citrico') {
          if (olf.includes('cítrico') || olf.includes('fresco') || desc.includes('limón') || desc.includes('bergamota')) score += 12;
        } else if (scentAnswers.note === 'vainilla') {
          if (olf.includes('dulce') || olf.includes('vainilla') || olf.includes('gourmand') || desc.includes('vainilla') || desc.includes('azúcar')) score += 12;
        } else if (scentAnswers.note === 'amaderado') {
          if (olf.includes('amaderado') || olf.includes('cuero') || olf.includes('oud') || desc.includes('sándalo') || desc.includes('cedro') || desc.includes('maderas')) score += 12;
        } else { // floral
          if (olf.includes('floral') || olf.includes('rosa') || desc.includes('jazmín') || desc.includes('flores')) score += 12;
        }

        return { product: p, score };
      });

      // Ordenar por puntaje descendente y filtrar agotados si es posible
      scored.sort((a, b) => b.score - a.score);
      const matches = scored.slice(0, 3).map(x => x.product);

      if (!matches.length) {
        resultsContainer.innerHTML = `<p style="text-align:center;color:var(--text3)">No se encontraron coincidencias.</p>`;
        return;
      }

      // Renderizar resultados
      resultsContainer.innerHTML = matches.map(p => {
        const pPrices = Object.values(p.sizes || {}).filter(v => v > 0);
        const minPrice = p.type === 'entero'
          ? (p.enteroPrice > 0 ? p.enteroPrice : (pPrices.length ? Math.min(...pPrices) : 0))
          : (pPrices.length ? Math.min(...pPrices) : 0);

        const imgHtml = p.imageUrl
          ? `<img src="${p.imageUrl}" alt="${p.name}" class="scent-res-img" onerror="this.style.display='none'">`
          : `<div class="scent-res-img-ph">🧪</div>`;

        const sizeLabel = p.type === 'entero' ? 'Frasco' : 'Decant';
        const genderLabel = p.gender === 'hombre' ? 'Hombre' : p.gender === 'mujer' ? 'Mujer' : 'Unisex';

        return `
          <div class="scent-res-card">
            <div class="scent-res-left">
              <div class="scent-res-img-wrap">${imgHtml}</div>
              <div class="scent-res-info">
                <span class="scent-res-brand">${p.brand}</span>
                <h4 class="scent-res-name">${p.name}</h4>
                <div class="scent-res-badges">
                  <span>${p.olfFamily || 'Fragancia'}</span>
                  <span>${genderLabel}</span>
                </div>
              </div>
            </div>
            <div class="scent-res-right">
              ${minPrice > 0 ? `<span class="scent-res-price">S/ ${minPrice}</span>` : ''}
              <button class="scent-action-btn scent-btn-view" data-id="${p.id}">Ver detalles</button>
              <button class="scent-action-btn scent-btn-add ${!p.inStock ? 'disabled' : ''}" 
                      data-id="${p.id}" ${!p.inStock ? 'disabled' : ''}>
                ${!p.inStock ? 'Agotado' : 'Añadir'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Agregar listeners
      resultsContainer.querySelectorAll('.scent-btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
          closeScentFinder();
          if (typeof window.openPdModal === 'function') {
            window.openPdModal(parseInt(btn.dataset.id));
          }
        });
      });

      resultsContainer.querySelectorAll('.scent-btn-add').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = parseInt(btn.dataset.id);
          const p = allProducts.find(x => x.id === pid);
          if (!p) return;

          // Añadir primer tamaño disponible
          if (p.type === 'entero') {
            const enteroPrice = p.enteroPrice > 0 ? p.enteroPrice : Math.min(...Object.values(p.sizes || {}));
            window.Cart?.add(p, 'Unidad', enteroPrice);
          } else {
            const firstSize = Object.keys(p.sizes)[0];
            const firstPrice = p.sizes[firstSize];
            window.Cart?.add(p, firstSize, firstPrice);
          }

          btn.textContent = 'Añadido ✓';
          btn.style.background = '#25d366';
          btn.style.color = '#fff';
          setTimeout(() => {
            btn.textContent = 'Añadir';
            btn.style.background = '';
            btn.style.color = '';
          }, 1500);
        });
      });

      // Efecto confeti de GSAP / Partículas
      if (window.burstCampaignDecor) {
        window.burstCampaignDecor();
      }

    }, 1500);
  }

  // Inicializar al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    initStories();
    initScentFinder();
  });

})();
