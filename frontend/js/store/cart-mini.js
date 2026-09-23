// ─── Carrito mini — páginas secundarias (nosotros, contacto) ──────────────────

(function () {

  function sanitize(str) {
    return String(str ?? '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const MiniCart = {
    items: [],

    load() {
      try {
        const saved = localStorage.getItem('micht_cart');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) this.items = parsed;
        }
      } catch(e) {}
    },

    save() {
      try { localStorage.setItem('micht_cart', JSON.stringify(this.items)); } catch(e) {}
    },

    remove(pid, size) {
      this.items = this.items.filter(i => !(i.productId === pid && i.size === size));
      this.save();
      this.render();
    },

    updateQty(pid, size, qty) {
      const item = this.items.find(i => i.productId === pid && i.size === size);
      if (!item) return;
      if (qty > 10) qty = 10;
      if (qty < 1) { this.remove(pid, size); return; }
      item.quantity = qty;
      this.save();
      this.render();
    },

    total() { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); },
    count() { return this.items.reduce((s, i) => s + i.quantity, 0); },

    clear() { this.items = []; this.save(); this.render(); },

    showCart() {
      const sidebar = document.getElementById('cartSidebar');
      const overlay = document.getElementById('overlay');
      if (sidebar) sidebar.classList.add('open');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    },

    hideCart() {
      const sidebar = document.getElementById('cartSidebar');
      const overlay = document.getElementById('overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    },

    render() {
      const container = document.getElementById('cartItems');
      const totalEl   = document.getElementById('cartTotal');
      if (!container || !totalEl) return;

      const n = this.count();

      // Actualizar badge en el botón flotante (nosotros o contacto)
      ['nosotrosCartCount', 'contactoCartCount'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent     = n > 99 ? '99+' : n;
        el.style.display   = n > 0 ? 'flex' : 'none';
      });

      const clearBtn = document.getElementById('clearCartBtn');
      if (clearBtn) clearBtn.style.display = n > 0 ? 'flex' : 'none';

      totalEl.textContent = `S/ ${this.total().toFixed(2)}`;

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
        const thumbHtml = item.imageUrl
          ? `<img src="${escapeAttr(item.imageUrl)}" alt="" class="cart-item-thumb" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="cart-item-thumb-ph"><svg viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="10" y="0" width="12" height="4" rx="1"/><path d="M8 4C4 4 2 8 2 12L2 44C2 46 4 48 6 48L26 48C28 48 30 46 30 44L30 12C30 8 28 4 24 4Z"/><line x1="2" y1="14" x2="30" y2="14"/></svg></div>`;

        return `
        <div class="cart-item">
          <div class="cart-item-header">
            ${thumbHtml}
            <div class="cart-item-info">
              <p class="cart-item-name">${sanitize(item.brand)} · ${sanitize(item.productName)}</p>
              <p class="cart-item-size"><span class="decant-chip">${sanitize(item.size)}</span> S/ ${item.price.toFixed(2)} c/u</p>
            </div>
          </div>
          <div class="cart-item-controls">
            <button class="qty-btn" data-action="dec" data-id="${item.productId}" data-size="${escapeAttr(item.size)}">−</button>
            <input type="number" class="qty-val qty-direct" min="1" max="10" value="${item.quantity}"
                   data-id="${item.productId}" data-size="${escapeAttr(item.size)}" aria-label="Cantidad">
            <button class="qty-btn" data-action="inc" data-id="${item.productId}" data-size="${escapeAttr(item.size)}">+</button>
            <button class="remove-btn" data-id="${item.productId}" data-size="${escapeAttr(item.size)}" aria-label="Eliminar">×</button>
          </div>
          <p class="cart-item-sub">S/ ${(item.price * item.quantity).toFixed(2)}</p>
        </div>`;
      }).join('');

      container.querySelectorAll('.qty-btn').forEach(btn =>
        btn.addEventListener('click', () => {
          const id   = parseInt(btn.dataset.id);
          const size = btn.dataset.size;
          const item = MiniCart.items.find(i => i.productId === id && i.size === size);
          if (item) MiniCart.updateQty(id, size, item.quantity + (btn.dataset.action === 'inc' ? 1 : -1));
        })
      );

      container.querySelectorAll('.qty-direct').forEach(inp => {
        inp.addEventListener('change', () => {
          const id   = parseInt(inp.dataset.id);
          const size = inp.dataset.size;
          const qty  = Math.max(1, Math.min(10, parseInt(inp.value) || 1));
          MiniCart.updateQty(id, size, qty);
        });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
      });

      container.querySelectorAll('.remove-btn').forEach(btn =>
        btn.addEventListener('click', () => MiniCart.remove(parseInt(btn.dataset.id), btn.dataset.size))
      );
    }
  };

  // ── Inicializar ────────────────────────────────────────────────────────────
  MiniCart.load();
  MiniCart.render();

  // ── Botón flotante del carrito ─────────────────────────────────────────────
  document.querySelectorAll('.floating-cart-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      MiniCart.showCart();
    });
  });

  // ── Cerrar ─────────────────────────────────────────────────────────────────
  document.getElementById('closeCart')?.addEventListener('click',   () => MiniCart.hideCart());
  document.getElementById('overlay')?.addEventListener('click',     () => MiniCart.hideCart());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('cartSidebar')?.classList.contains('open'))
      MiniCart.hideCart();
  });

  // ── Vaciar carrito ─────────────────────────────────────────────────────────
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    if (confirm('¿Vaciar el carrito?')) MiniCart.clear();
  });

  // ── "Proceder al Pedido" → ir al inicio para completar la compra ───────────
  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    window.location.href = '../?cart=1';
  });

})();
