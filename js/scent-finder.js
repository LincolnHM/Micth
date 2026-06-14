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
          calculateScentResults().catch(console.error);
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

  async function calculateScentResults() {
    goToScentStep(4);
    const resultsContainer = document.getElementById('scentResultsList');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="scent-loader-wrap">
        <div class="scent-spinner"></div>
        <p>Destilando fragancias perfectas para ti...</p>
      </div>
    `;

    await new Promise(resolve => setTimeout(resolve, 1400));

    // Cargar productos: _allProducts → Products.getAll() → CloudProducts.getAll()
    let allProducts = (Array.isArray(window._allProducts) && window._allProducts.length)
      ? window._allProducts
      : (typeof Products !== 'undefined' ? Products.getAll() : []);

    if (!allProducts.length && typeof CloudProducts !== 'undefined') {
      try {
        allProducts = await CloudProducts.getAll();
        if (allProducts.length) window._allProducts = allProducts;
      } catch (e) {
        console.error('[ScentFinder] Error cargando productos:', e);
      }
    }

    if (!allProducts.length) {
      resultsContainer.innerHTML = `
        <div class="scent-empty-state">
          <p>No pudimos cargar el catálogo en este momento.</p>
          <p style="color:var(--text3);font-size:0.8rem;margin-top:0.4rem">Recarga la página e intenta de nuevo.</p>
        </div>
      `;
      return;
    }

    // Función de puntaje
    const scoreProduct = (p) => {
      let score = 0;
      const olf   = (p.olfFamily   || '').toLowerCase();
      const desc  = (p.description || '').toLowerCase();
      const notes = [(p.topNotes || ''), (p.heartNotes || ''), (p.baseNotes || '')].join(' ').toLowerCase();

      // Género (max 10)
      if (scentAnswers.gender === 'hombre') {
        if (p.gender === 'hombre') score += 10;
        else if (p.gender === 'unisex') score += 5;
      } else if (scentAnswers.gender === 'mujer') {
        if (p.gender === 'mujer') score += 10;
        else if (p.gender === 'unisex') score += 5;
      } else {
        if (p.gender === 'unisex') score += 10;
        else score += 3;
      }

      // Vibra (max 13)
      if (scentAnswers.vibe === 'fresco') {
        if (p.occasion === 'dia') score += 5;
        if (olf.includes('cítrico') || olf.includes('fresco') || olf.includes('acuático') || olf.includes('aromático')) score += 8;
      } else if (scentAnswers.vibe === 'elegante') {
        if (p.occasion === 'dia' || p.occasion === 'ambas') score += 5;
        if (olf.includes('amaderado') || olf.includes('fougere') || olf.includes('chipre') || olf.includes('cuero')) score += 8;
      } else if (scentAnswers.vibe === 'nocturno') {
        if (p.occasion === 'noche' || p.occasion === 'ambas') score += 7;
        if (olf.includes('ámbar') || olf.includes('especiado') || olf.includes('dulce') || olf.includes('oriental')) score += 8;
      } else {
        if (p.occasion === 'dia' || p.occasion === 'ambas') score += 6;
        if (olf.includes('almizcle') || olf.includes('frutal') || olf.includes('floral')) score += 8;
      }

      // Notas olfativas (max 12) — también busca en notas del producto
      if (scentAnswers.note === 'citrico') {
        if (olf.includes('cítrico') || olf.includes('fresco')) score += 12;
        else if (notes.includes('limón') || notes.includes('bergamota') || notes.includes('naranja') || notes.includes('pomelo')) score += 10;
        else if (desc.includes('cítrico') || desc.includes('limón')) score += 6;
      } else if (scentAnswers.note === 'vainilla') {
        if (olf.includes('dulce') || olf.includes('vainilla') || olf.includes('gourmand')) score += 12;
        else if (notes.includes('vainilla') || notes.includes('tonka') || notes.includes('caramelo')) score += 10;
        else if (desc.includes('vainilla') || desc.includes('dulce')) score += 6;
      } else if (scentAnswers.note === 'amaderado') {
        if (olf.includes('amaderado') || olf.includes('oud') || olf.includes('cuero')) score += 12;
        else if (notes.includes('sándalo') || notes.includes('cedro') || notes.includes('oud') || notes.includes('vetiver') || notes.includes('patchouli')) score += 10;
        else if (desc.includes('madera') || desc.includes('sándalo')) score += 6;
      } else {
        if (olf.includes('floral')) score += 12;
        else if (notes.includes('rosa') || notes.includes('jazmín') || notes.includes('lirio') || notes.includes('peonia')) score += 10;
        else if (desc.includes('floral') || desc.includes('flores')) score += 6;
      }

      return score;
    };

    const MAX_SCORE = 35;

    const scored = allProducts
      .filter(p => p && (p.type === 'decant' || p.type === 'entero'))
      .map(p => ({ product: p, score: scoreProduct(p) }))
      .filter(x => x.score > 0);

    // Ordenar: en stock primero, luego mayor puntaje
    scored.sort((a, b) => {
      const sA = a.product.inStock !== false ? 1 : 0;
      const sB = b.product.inStock !== false ? 1 : 0;
      if (sA !== sB) return sB - sA;
      return b.score - a.score;
    });

    const matches = scored.slice(0, 5);

    if (!matches.length) {
      resultsContainer.innerHTML = `
        <div class="scent-empty-state">
          <p>No encontramos fragancias que coincidan con tu perfil.</p>
          <p style="color:var(--text3);font-size:0.8rem;margin-top:0.4rem">Prueba con otras respuestas o explora el catálogo.</p>
        </div>
      `;
      return;
    }

    const matchLabel = (score) => {
      const pct = Math.round((score / MAX_SCORE) * 100);
      if (pct >= 80) return { label: 'Coincidencia perfecta', emoji: '✨', cls: 'match-perfect' };
      if (pct >= 60) return { label: 'Alta coincidencia',     emoji: '⭐', cls: 'match-high'    };
      if (pct >= 40) return { label: 'Buena coincidencia',    emoji: '👍', cls: 'match-good'    };
      return              { label: 'Coincidencia',            emoji: '🔎', cls: 'match-low'     };
    };

    resultsContainer.innerHTML = matches.map(({ product: p, score }) => {
      const match   = matchLabel(score);
      const inStock = p.inStock !== false;
      const gLabel  = p.gender === 'hombre' ? 'Hombre' : p.gender === 'mujer' ? 'Mujer' : 'Unisex';

      const imgHtml = p.imageUrl
        ? `<img src="${p.imageUrl}" alt="${p.name}" class="scent-res-img" onerror="this.style.display='none'">`
        : `<div class="scent-res-img-ph">🧪</div>`;

      let sizesHtml = '';
      if (p.type === 'decant' && Object.keys(p.sizes || {}).length) {
        const sizeEntries = Object.entries(p.sizes).filter(([, v]) => v > 0);
        sizesHtml = `
          <div class="scent-sizes" data-pid="${p.id}">
            ${sizeEntries.map(([sz, pr], i) => `
              <button class="scent-size-btn ${i === 0 ? 'active' : ''}" data-size="${sz}" data-price="${pr}">
                ${sz} · S/${pr}
              </button>
            `).join('')}
          </div>
        `;
      } else if (p.type === 'entero') {
        const pr = p.enteroPrice > 0 ? p.enteroPrice : Math.min(...Object.values(p.sizes || { 0: 0 }));
        sizesHtml = `<div class="scent-size-fixed">S/ ${pr > 0 ? pr : '—'}</div>`;
      }

      return `
        <div class="scent-res-card ${!inStock ? 'out-of-stock' : ''}">
          <div class="scent-match-badge ${match.cls}">${match.emoji} ${match.label}</div>
          <div class="scent-res-body">
            <div class="scent-res-img-wrap">${imgHtml}</div>
            <div class="scent-res-info">
              <span class="scent-res-brand">${p.brand}</span>
              <h4 class="scent-res-name">${p.name}</h4>
              <div class="scent-res-badges">
                ${p.olfFamily ? `<span>${p.olfFamily}</span>` : ''}
                <span>${gLabel}</span>
                ${!inStock ? '<span class="scent-badge-agotado">Agotado</span>' : ''}
              </div>
              ${sizesHtml}
            </div>
          </div>
          <div class="scent-res-actions">
            <button class="scent-action-btn scent-btn-view" data-id="${p.id}">Ver detalles</button>
            <button class="scent-action-btn scent-btn-add ${!inStock ? 'disabled' : ''}"
                    data-id="${p.id}" ${!inStock ? 'disabled' : ''}>
              ${!inStock ? '❌ Agotado' : '🛒 Añadir'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Listeners de selección de tamaño
    resultsContainer.querySelectorAll('.scent-sizes').forEach(wrap => {
      wrap.querySelectorAll('.scent-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          wrap.querySelectorAll('.scent-size-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    });

    // Ver detalles
    resultsContainer.querySelectorAll('.scent-btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        closeScentFinder();
        if (typeof window.openPdModal === 'function') {
          window.openPdModal(parseInt(btn.dataset.id));
        }
      });
    });

    // Añadir al carrito
    resultsContainer.querySelectorAll('.scent-btn-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = parseInt(btn.dataset.id);
        const p   = allProducts.find(x => x.id === pid);
        if (!p) return;

        let sz, pr;
        if (p.type === 'entero') {
          sz = 'Unidad';
          pr = p.enteroPrice > 0 ? p.enteroPrice : Math.min(...Object.values(p.sizes || { 0: 0 }));
        } else {
          const wrap      = resultsContainer.querySelector(`.scent-sizes[data-pid="${pid}"]`);
          const activeBtn = wrap?.querySelector('.scent-size-btn.active');
          sz = activeBtn?.dataset.size  || Object.keys(p.sizes || {})[0];
          pr = activeBtn ? parseFloat(activeBtn.dataset.price) : Object.values(p.sizes || {})[0];
        }

        window.Cart?.add(p, sz, pr);
        btn.textContent      = '✓ Añadido';
        btn.style.background = '#25d366';
        btn.style.color      = '#fff';
        setTimeout(() => {
          btn.textContent      = '🛒 Añadir';
          btn.style.background = '';
          btn.style.color      = '';
        }, 1800);
      });
    });

    window.burstCampaignDecor?.();
  }

  // Inicializar al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    initStories();
    initScentFinder();
  });

})();
