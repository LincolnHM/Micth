// ─── Combos de Decants (vitrina pública) ───────────────────────────────────
// Un combo es un set fijo de 2-3 perfumes (uno de cada uno). NO tiene un
// único precio: tiene hasta 4, uno por talla (2/3/5/10ml) — el cliente elige
// con qué talla quiere TODOS los perfumes del combo y ve el antes/después de
// esa talla en particular. El "antes" se recalcula en vivo contra el
// catálogo actual (comboSizeInfo, definida en js/shared/data.js).

let _allCombos = null;

function _comboCardPricingHtml(combo, products, size) {
  const { before } = comboSizeInfo(combo, products, size);
  const price = parseFloat(combo.prices?.[size]) || 0;
  const savings = before - price;
  const pct = before > 0 ? Math.round(savings / before * 100) : 0;
  const inCart = Cart.items.some(i => i.isCombo && i.comboId === combo.id && i.size === size);
  return { before, price, savings, pct, inCart };
}

// Redibuja solo el precio/ahorro/botón de UNA tarjeta (no toda la grilla) al
// cambiar de talla — así no se pierde el scroll del carrusel ni se reinicia
// una animación por elegir otra talla.
function updateComboCardPricing(combo, products) {
  const card = document.querySelector(`.combo-card[data-combo-id="${combo.id}"]`);
  if (!card) return;
  const size = card.dataset.selectedSize;
  const { before, price, savings, pct, inCart } = _comboCardPricingHtml(combo, products, size);

  card.querySelectorAll('.combo-size-select-btn').forEach(b => b.classList.toggle('selected', b.dataset.size === size));

  const pricesEl  = card.querySelector('.combo-card-prices');
  const savingsEl = card.querySelector('.combo-card-savings');
  const ribbonEl  = card.querySelector('.combo-card-ribbon');
  const addBtn    = card.querySelector('.combo-card-add-btn');

  pricesEl.innerHTML = `
    ${before > price ? `<span class="combo-card-before">S/ ${before.toFixed(2)}</span>` : ''}
    <span class="combo-card-final">S/ ${price.toFixed(2)}</span>`;
  if (savings > 0) {
    savingsEl.style.display = '';
    savingsEl.textContent = `Ahorras S/ ${savings.toFixed(2)} (${pct}%)`;
  } else {
    savingsEl.style.display = 'none';
  }
  if (ribbonEl) ribbonEl.textContent = pct > 0 ? `-${pct}%` : '';
  if (ribbonEl) ribbonEl.style.display = pct > 0 ? '' : 'none';
  addBtn.classList.toggle('added', inCart);
  addBtn.textContent = inCart ? '✓ En el carrito' : 'Agregar combo al carrito';
}

async function renderCombos() {
  const section = document.getElementById('combos');
  const grid    = document.getElementById('combosGrid');
  if (!section || !grid) return;

  let combos = [];
  try {
    combos = await Promise.race([
      CloudCombos.getAll(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
    ]);
  } catch (_) {
    combos = Combos.getAll();
  }
  combos = combos.filter(c => c.active);
  _allCombos = combos;

  if (!combos.length) { section.style.display = 'none'; return; }

  const products = _allProducts || Products.getAll();
  const prodLookup = {};
  products.forEach(p => { prodLookup[p.id] = p; });

  const cardsData = combos.map(combo => {
    const items = (combo.items || []).filter(pid => prodLookup[pid]);
    const tiers = comboAvailableSizes(combo, products);
    return { combo, items, tiers };
  }).filter(d => d.items.length >= 2 && d.tiers.length);

  if (!cardsData.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  grid.innerHTML = cardsData.map(({ combo, items, tiers }) => {
    const firstSize = tiers[0].size;

    // Foto propia del combo (subida por el admin) tiene prioridad; si no hay,
    // se arma un collage automático con las fotos de los perfumes incluidos.
    const bannerHtml = combo.imageUrl
      ? `<div class="combo-card-banner"><img src="${escapeAttr(combo.imageUrl)}" alt="${escapeAttr(combo.title)}" loading="lazy"></div>`
      : '';
    const thumbsHtml = !combo.imageUrl
      ? items.slice(0, 4)
          .map(pid => prodLookup[pid].imageUrl)
          .filter(Boolean)
          .map(img => `<img src="${escapeAttr(img)}" alt="" class="combo-card-thumb" loading="lazy">`)
          .join('')
      : '';

    const itemsChips = items.map(pid => {
      const p = prodLookup[pid];
      return `<span class="combo-card-item-chip">${sanitize(p.brand)} ${sanitize(p.name)}</span>`;
    }).join('');

    const sizesHtml = tiers.map(t => `
      <button type="button" class="combo-size-select-btn ${t.size === firstSize ? 'selected' : ''}" data-size="${t.size}">
        <span class="combo-size-select-ml">${sanitize(t.size)}</span>
        <span class="combo-size-select-price">S/${t.price}</span>
      </button>`).join('');

    return `
      <article class="combo-card" data-combo-id="${combo.id}" data-selected-size="${firstSize}" role="listitem">
        <div class="combo-card-ribbon"></div>
        <div class="combo-card-badge">Combo</div>
        ${bannerHtml}
        ${thumbsHtml ? `<div class="combo-card-thumbs">${thumbsHtml}</div>` : ''}
        <h3 class="combo-card-name">${sanitize(combo.title)}</h3>
        ${combo.description ? `<p class="combo-card-desc">${sanitize(combo.description)}</p>` : ''}
        <div class="combo-card-items">${itemsChips}</div>
        ${tiers.length > 1 ? `<div class="combo-card-sizes">${sizesHtml}</div>` : ''}
        <div class="combo-card-footer">
          <div class="combo-card-prices"></div>
          <span class="combo-card-savings"></span>
          <button class="combo-card-add-btn" data-combo-id="${combo.id}">Agregar combo al carrito</button>
        </div>
      </article>`;
  }).join('');

  cardsData.forEach(({ combo }) => updateComboCardPricing(combo, products));

  grid.querySelectorAll('.combo-size-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.combo-card');
      const combo = combos.find(c => c.id === parseInt(card.dataset.comboId));
      card.dataset.selectedSize = btn.dataset.size;
      if (combo) updateComboCardPricing(combo, products);
    });
  });

  grid.querySelectorAll('.combo-card-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.combo-card');
      const combo = combos.find(c => c.id === parseInt(btn.dataset.comboId));
      if (combo) Cart.addCombo(combo, products, card.dataset.selectedSize);
    });
  });
}

// Flechas del carrusel de combos — desplazan el track una tarjeta a la vez.
// Se enganchan una sola vez: el contenedor #combosGrid no se reemplaza entre
// renders, solo su contenido interno.
function initCombosCarousel() {
  const track = document.getElementById('combosGrid');
  const prev  = document.getElementById('combosPrev');
  const next  = document.getElementById('combosNext');
  if (!track || !prev || !next) return;

  const scrollByCard = dir => {
    const card = track.querySelector('.combo-card');
    const amount = card ? card.getBoundingClientRect().width + 18 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  prev.addEventListener('click', () => scrollByCard(-1));
  next.addEventListener('click', () => scrollByCard(1));
}
