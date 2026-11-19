// ─── MICHT Decants · Carruseles que avanzan solos ────────────────────────────
// Lo usan Combos (combos-carousel.js) y Próximamente (coming-soon.js).
//
//   attachAutoCarousel(track, { prev, next, interval, card })
//
// · Avanza una tarjeta cada `interval` ms. Al llegar a la última vuelve a la
//   primera (y la flecha ‹ en la primera salta a la última): así se ven todas.
// · Se detiene mientras el cliente lo usa: con el mouse encima, mientras lo
//   toca o desliza (y unos segundos después de soltar), con el foco del teclado
//   dentro, si el carrusel no está en pantalla o si la pestaña está oculta.
// · Las flechas y el dedo siguen funcionando; tocar una flecha reinicia la cuenta.
// · Con "reducir movimiento" activado en el equipo no avanza solo.
// · Si las tarjetas entran todas en el ancho no hace nada y oculta las flechas.
//
// Devuelve { sync } para volver a medir después de cambiar las tarjetas.

function attachAutoCarousel(track, { prev = null, next = null, interval = 4500, card = null } = {}) {
  if (!track) return null;
  if (track._autoCarousel) return track._autoCarousel;

  const reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const box = track.parentElement || track;   // incluye las flechas
  const RESUME_AFTER_TOUCH = 6000;
  let timer = null;
  let hovering = false, focused = false, onScreen = true;
  let touchUntil = 0;

  const overflowing = () => track.scrollWidth > track.clientWidth + 4;
  const firstCard   = () => (card && track.querySelector(card)) || track.firstElementChild;
  const stepSize = () => {
    const c = firstCard();
    if (!c) return track.clientWidth * 0.8;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
    return c.getBoundingClientRect().width + gap;
  };
  const atEnd   = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
  const atStart = () => track.scrollLeft <= 8;

  function go(dir) {
    if (!overflowing()) return;
    if (dir > 0 && atEnd())        track.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir < 0 && atStart()) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
    else track.scrollBy({ left: dir * stepSize(), behavior: 'smooth' });
  }

  const paused = () => hovering || focused || !onScreen || document.hidden || Date.now() < touchUntil;

  function restart() {
    clearInterval(timer);
    timer = null;
    if (reduceMotion || !overflowing()) return;
    timer = setInterval(() => { if (!paused()) go(1); }, interval);
  }

  function sync() {
    const over = overflowing();
    if (prev) prev.hidden = !over;
    if (next) next.hidden = !over;
    box.classList.toggle('is-auto', over && !reduceMotion);
    restart();
  }

  prev?.addEventListener('click', () => { go(-1); restart(); });
  next?.addEventListener('click', () => { go(1); restart(); });

  // Mouse encima (solo mouse: en el celular el "hover" se queda pegado al tocar)
  box.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovering = true; });
  box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hovering = false; });
  // Dedo: pausa mientras toca y un rato después de soltar
  const holdTouch = () => { touchUntil = Date.now() + RESUME_AFTER_TOUCH; };
  track.addEventListener('touchstart', () => { touchUntil = Infinity; }, { passive: true });
  track.addEventListener('touchend', holdTouch, { passive: true });
  track.addEventListener('touchcancel', holdTouch, { passive: true });
  // Rueda / trackpad horizontal en la PC
  track.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) holdTouch(); }, { passive: true });
  // Teclado
  box.addEventListener('focusin', () => { focused = true; });
  box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) focused = false; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { onScreen = entries[entries.length - 1].isIntersecting; }, { threshold: 0.25 })
      .observe(track);
  }

  let resizeT = null;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(sync, 150); });

  const api = { sync, go };
  track._autoCarousel = api;
  sync();
  return api;
}
