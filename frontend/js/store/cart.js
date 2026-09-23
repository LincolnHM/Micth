// ─── Carrito + Catálogo con filtros avanzados ─────────────────────────────────

function showCartToast(msg) {
  let toast = document.getElementById('cartToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cartToast';
    toast.className = 'cart-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

const Cart = {
  items: [],
  _cartOpened: false,

  save() {
    try { localStorage.setItem('micht_cart', JSON.stringify(this.items)); } catch(e) {}
  },

  load() {
    try {
      const saved = localStorage.getItem('micht_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) this.items = parsed;
      }
    } catch(e) {}
  },

  add(product, size, price) {
    if (price <= 0) { showCartToast('Precio no configurado para este tamaño.'); return; }
    const existing = this.items.find(i => i.productId === product.id && i.size === size);
    if (existing) {
      if (existing.quantity >= 10) { showCartToast('Máximo 10 unidades por producto.'); return; }
      existing.quantity++;
    } else {
      this.items.push({ productId: product.id, productName: product.name, brand: product.brand, size, price, quantity: 1, imageUrl: product.imageUrl || '' });
    }
    showCartToast(`${product.brand} – ${product.name} (${size}) agregado`);
    this.save();
    this.render();
    if (!this._cartOpened) {
      this._cartOpened = true;
      this.showCart();
    }
    this.bounce();
  },

  // El combo no tiene un precio único — el cliente elige la talla (2/3/5/10ml)
  // y esa talla aplica a TODOS los perfumes del combo por igual. `size` es
  // la talla elegida; el precio sale de combo.prices[size].
  addCombo(combo, allProducts, size) {
    const price = parseFloat(combo.prices?.[size]) || 0;
    if (price <= 0) { showCartToast('Esa talla no está disponible para este combo.'); return; }

    const lookup = new Map((allProducts || _allProducts || Products.getAll()).map(p => [p.id, p]));
    const existing = this.items.find(i => i.isCombo && i.comboId === combo.id && i.size === size);
    if (existing) {
      if (existing.quantity >= 10) { showCartToast('Máximo 10 combos por pedido.'); return; }
      existing.quantity++;
    } else {
      const comboItems = (combo.items || []).map(productId => {
        const p = lookup.get(productId);
        return { productId, size, qty: 1, name: p?.name || '', brand: p?.brand || '' };
      });
      const firstImg = (combo.items || []).map(productId => lookup.get(productId)?.imageUrl).find(Boolean) || '';
      const compositionLabel = comboItems.map(ci => `${ci.brand} ${ci.name}`).join(', ');
      this.items.push({
        productId: -combo.id,
        isCombo: true,
        comboId: combo.id,
        productName: combo.title,
        brand: 'Combo MICHT',
        size,
        price,
        quantity: 1,
        imageUrl: firstImg,
        comboItems,
        comboComposition: compositionLabel
      });
    }
    showCartToast(`Combo "${combo.title}" (${size}) agregado`);
    this.save();
    this.render();
    if (typeof renderCombos === 'function') renderCombos();
    if (!this._cartOpened) {
      this._cartOpened = true;
      this.showCart();
    }
    this.bounce();
  },

  remove(pid, size)  {
    this.items = this.items.filter(i => !(i.productId === pid && i.size === size));
    this.save();
    this.render();
    if (pid < 0 && typeof renderCombos === 'function') renderCombos();
  },
  updateQty(pid, size, qty) {
    const item = this.items.find(i => i.productId === pid && i.size === size);
    if (!item) return;
    if (qty > 10) qty = 10;
    qty < 1 ? this.remove(pid, size) : (item.quantity = qty, this.save(), this.render());
  },
  total()  { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); },
  count()  { return this.items.reduce((s, i) => s + i.quantity, 0); },
  clear()  { this.items = []; this._cartOpened = false; this.save(); this.render(); if (typeof renderProducts === 'function') renderProducts(); },

  showCart() {
    document.getElementById('cartSidebar')?.classList.add('open');
    document.getElementById('overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  },
  hideCart() {
    document.getElementById('cartSidebar')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('active');
    document.body.style.overflow = '';
  },

  bounce() {
    const btn = document.getElementById('cartBtn');
    if (!btn) return;
    btn.classList.add('bounce');
    setTimeout(() => btn.classList.remove('bounce'), 400);
  },

  render() {
    const container = document.getElementById('cartItems');
    const countEl   = document.getElementById('cartCount');
    const totalEl   = document.getElementById('cartTotal');
    if (!container || !countEl || !totalEl) return;

    const n = this.count();
    countEl.textContent = n;
    countEl.style.display = n > 0 ? 'flex' : 'none';
    totalEl.textContent = `S/ ${this.total().toFixed(2)}`;

    const clearBtn = document.getElementById('clearCartBtn');
    if (clearBtn) clearBtn.style.display = n > 0 ? 'flex' : 'none';

    if (!this.items.length) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">🛍️</div>
          <p>Tu carrito está vacío</p>
          <span>Agrega decants del catálogo</span>
        </div>`;
      return;
    }

    container.innerHTML = this.items.map(item => {
      const imgUrl = item.imageUrl ||
        (_allProducts?.find(p => p.id === item.productId) ?? Products.getById(item.productId))?.imageUrl ||
        '';
      const thumbHtml = imgUrl
        ? `<img src="${escapeAttr(imgUrl)}" alt="" class="cart-item-thumb" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="cart-item-thumb-ph"><svg viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="10" y="0" width="12" height="4" rx="1"/><path d="M8 4C4 4 2 8 2 12L2 44C2 46 4 48 6 48L26 48C28 48 30 46 30 44L30 12C30 8 28 4 24 4Z"/><line x1="2" y1="14" x2="30" y2="14"/></svg></div>`;
      return `
      <div class="cart-item">
        <div class="cart-item-header">
          ${thumbHtml}
          <div class="cart-item-info">
            <p class="cart-item-name">${sanitize(item.brand)} · ${sanitize(item.productName)}</p>
            <p class="cart-item-size"><span class="decant-chip">${sanitize(item.size)}</span> S/ ${item.price.toFixed(2)} c/u</p>
            ${item.isCombo && item.comboComposition ? `<p class="cart-item-combo-composition">Incluye: ${sanitize(item.comboComposition)}</p>` : ''}
          </div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" data-id="${item.productId}" data-size="${escapeAttr(item.size)}">−</button>
          <input type="number" class="qty-val qty-direct" min="1" max="10" value="${item.quantity}" data-id="${item.productId}" data-size="${escapeAttr(item.size)}" aria-label="Cantidad">
          <button class="qty-btn" data-action="inc" data-id="${item.productId}" data-size="${escapeAttr(item.size)}">+</button>
          <button class="remove-btn" data-id="${item.productId}" data-size="${escapeAttr(item.size)}" aria-label="Eliminar">×</button>
        </div>
        <p class="cart-item-sub">S/ ${(item.price * item.quantity).toFixed(2)}</p>
      </div>
    `;
    }).join('');

    container.querySelectorAll('.qty-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id), size = btn.dataset.size;
        const item = Cart.items.find(i => i.productId === id && i.size === size);
        if (item) Cart.updateQty(id, size, item.quantity + (btn.dataset.action === 'inc' ? 1 : -1));
      })
    );
    container.querySelectorAll('.qty-direct').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = parseInt(inp.dataset.id), size = inp.dataset.size;
        const qty = Math.max(1, Math.min(10, parseInt(inp.value) || 1));
        Cart.updateQty(id, size, qty);
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    });
    container.querySelectorAll('.remove-btn').forEach(btn =>
      btn.addEventListener('click', () => Cart.remove(parseInt(btn.dataset.id), btn.dataset.size))
    );
  }
};

function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ─── Validación de stock ──────────────────────────────────────────────────────

function validateCartStock() {
  // Se suma por perfume (el mismo perfume en dos tallas sale del mismo frasco) e
  // incluye los perfumes dentro de cada combo del carrito.
  const products = _allProducts || Products.getAll();
  return stockShortages(Cart.items, new Map(products.map(p => [p.id, p])));
}

function showStockAlert(errors) {
  let modal = document.getElementById('stockAlertModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stockAlertModal';
    modal.className = 'stock-alert-modal';
    modal.innerHTML = `
      <div class="stock-alert-backdrop"></div>
      <div class="stock-alert-box">
        <div class="stock-alert-icon">⚠️</div>
        <h3 class="stock-alert-title">Stock insuficiente</h3>
        <div id="stockAlertList" class="stock-alert-list"></div>
        <p class="stock-alert-note">Por favor ajusta las cantidades antes de continuar.</p>
        <button id="stockAlertClose" class="stock-alert-btn">Entendido</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.stock-alert-backdrop').addEventListener('click', () => modal.classList.remove('open'));
    document.getElementById('stockAlertClose').addEventListener('click', () => modal.classList.remove('open'));
  }
  document.getElementById('stockAlertList').innerHTML = errors.map(e =>
    e.type === 'agotado'
      ? `<div class="stock-alert-item"><span class="stock-alert-dot"></span>${sanitize(e.name)} — <strong>Agotado</strong></div>`
      : e.type === 'ml'
      ? `<div class="stock-alert-item"><span class="stock-alert-dot"></span>${sanitize(e.name)} — Solo quedan <strong>~${Number(e.remaining) || 0} ml</strong> (tu pedido suma ${Number(e.requested) || 0} ml)</div>`
      : `<div class="stock-alert-item"><span class="stock-alert-dot"></span>${sanitize(e.name)} — Solo quedan <strong>${Number(e.available) || 0}</strong> unidad${e.available !== 1 ? 'es' : ''}</div>`
  ).join('');
  modal.classList.add('open');
}
