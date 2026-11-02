// ═══════════════════════════════════════════════════════════════════════════════
// ─── PANEL DE LA VENDEDORA ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Lo ve quien entra al panel con app_metadata.role = 'vendedora' (ver
// backend/supabase/sql/2026-11-02-vendedoras.sql). Es una pantalla aparte del
// admin, pensada para el celular, con 4 pestañas:
//   · Vender      → registra un pedido que cerró por su WhatsApp
//   · Mis pedidos → solo los suyos; puede anular uno mientras la tienda no lo toque
//   · Stock       → ml que quedan y precios de venta (sin el costo)
//   · Mis ventas  → cuánto vendió y cuánto dinero tiene que entregar a la tienda
//
// Lo que puede o no puede hacer lo decide la BASE DE DATOS (precios reales del
// catálogo, sin descuentos, "Pagado", descuento de stock, solo sus pedidos). Esta
// pantalla solo lo hace cómodo.

const SELLER_PAY_METHODS = ['yape', 'efectivo', 'plin', 'transferencia'];

const _seller = {
  ready: false,
  name: '',
  products: [],
  lookup: new Map(),
  combos: [],               // combos activos (la tienda los arma en Combos)
  orders: [],
  cart: [],                 // { productId, name, brand, size, price, quantity }
  method: null,
  stockFilter: 'all',
  stockSearch: '',
  ordersFilter: 'all',
  period: 'mes',
};

function isSellerUser(user) {
  return user?.app_metadata?.role === 'vendedora';
}

const _sMoney = n => `S/ ${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;
const _sDate  = d => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
const _sTime  = d => new Date(d).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
const _sNorm  = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ── Arranque ─────────────────────────────────────────────────────────────────

async function showSellerPanel(user) {
  document.getElementById('loginSection').style.display     = 'none';
  document.getElementById('dashboardSection').style.display = 'none';
  const app = document.getElementById('sellerSection');
  app.style.display = 'flex';
  document.body.classList.add('seller-mode');

  // Si la registraron como vendedora con la sesión ya abierta, su token viejo no
  // trae el rol y la base la trataría como cliente: pedir uno nuevo.
  try {
    const { data } = await db.auth.getSession();
    if (!isSellerUser(data?.session?.user)) await db.auth.refreshSession();
  } catch (_) {}

  // Su nombre (y que siga activa)
  const { data: me, error } = await db.from('vendedoras').select('nombre, activa').eq('user_id', user.id).maybeSingle();
  if (error || !me || !me.activa) {
    await db.auth.signOut();
    app.style.display = 'none';
    showLoginScreen();
    const errEl = document.getElementById('loginError');
    if (errEl) {
      errEl.textContent = error
        ? 'No se pudo verificar tu acceso. Revisa tu conexión e inténtalo de nuevo.'
        : 'Tu acceso como vendedora está desactivado. Habla con la tienda.';
      errEl.style.display = 'block';
    }
    return;
  }
  _seller.name = me.nombre;
  document.getElementById('sellerName').textContent = me.nombre;

  if (!_seller.ready) {
    _seller.ready = true;
    _sellerBindEvents();
  }
  _sellerShow('vender');
  await Promise.all([_sellerLoadProducts(), _sellerLoadOrders()]);
  _sellerRenderAll();
}

async function _sellerLoadProducts() {
  try {
    const all = await withTimeout(CloudProducts.getAll({ client: dbPublic || db }), 15000, 'los perfumes');
    _seller.products = all.filter(p => !isComingSoon(p));
  } catch (err) {
    console.error('[MICHT] Vendedora: no se pudieron cargar los perfumes', err);
    _seller.products = [];
    showToast('⚠ No se pudieron cargar los perfumes. Revisa tu conexión.');
  }
  _seller.lookup = new Map(_seller.products.map(p => [p.id, p]));
  try {
    const combos = await withTimeout(CloudCombos.getAll({ client: dbPublic || db }), 15000, 'los combos');
    _seller.combos = combos.filter(c => c.active && (c.items || []).length);
  } catch (err) {
    console.error('[MICHT] Vendedora: no se pudieron cargar los combos', err);
    _seller.combos = [];
  }
}

async function _sellerLoadOrders() {
  // La base solo le devuelve SUS pedidos
  const { data, error } = await db.from('pedidos').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) {
    console.error('[MICHT] Vendedora: pedidos', error);
    showToast('⚠ No se pudieron cargar tus pedidos. Revisa tu conexión.');
    return;
  }
  _seller.orders = (data || []).map(orderFromDB);
}

function _sellerRenderAll() {
  _sellerRenderSearch();
  _sellerRenderCombos();
  _sellerRenderCart();
  _sellerRenderOrders();
  _sellerRenderStock();
  _sellerRenderSales();
}

function _sellerShow(view) {
  document.querySelectorAll('#sellerSection .seller-view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('#sellerSection .seller-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.getElementById('sellerCheckoutBar').hidden = view !== 'vender';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Qué tallas se pueden vender de un perfume ────────────────────────────────

// ¿Alcanza el stock si se agrega `extra` a lo que ya lleva el pedido? Cuenta
// juntos los perfumes sueltos y los que van dentro de combos (mismo frasco).
function _sellerFits(extra) {
  return stockShortages([..._seller.cart, extra], _seller.lookup).length === 0;
}

function _sellerOptions(p) {
  const out = [];
  if (!p) return out;
  const buyable = isDecantPurchasable(p);
  Object.entries(p.sizes || {}).forEach(([size, price]) => {
    price = parseFloat(price) || 0;
    if (price <= 0) return;
    if (p.type !== 'entero' && !/^\d/.test(size)) return;
    out.push({ size, price, ok: buyable && _sellerFits({ productId: p.id, size, quantity: 1 }) });
  });
  // Frasco entero sellado de un perfume que también va en decant
  if (p.type !== 'entero' && p.availableAsEntero && (p.enteroPrice || 0) > 0) {
    out.push({ size: 'Unidad', label: 'Entero', price: p.enteroPrice, ok: _sellerFits({ productId: p.id, size: 'Unidad', quantity: 1 }) });
  }
  return out;
}

// ── Combos: una talla para todos sus perfumes, precio del combo ──────────────
function _sellerComboLine(combo, size) {
  const comboItems = (combo.items || []).map(productId => {
    const p = _seller.lookup.get(productId);
    return { productId, size, qty: 1, name: p?.name || '', brand: p?.brand || '' };
  });
  return {
    isCombo: true, comboId: combo.id, productId: -combo.id,
    name: combo.title, brand: 'Combo MICHT', size,
    price: parseFloat(combo.prices?.[size]) || 0, quantity: 1,
    comboItems, composition: comboItems.map(ci => ci.name).filter(Boolean).join(' + ')
  };
}

function _sellerComboOptions(combo) {
  // Todos sus perfumes tienen que estar a la venta (no agotados ni en "Próximamente")
  const allBuyable = (combo.items || []).every(id => isDecantPurchasable(_seller.lookup.get(id)));
  return comboAvailableSizes(combo, _seller.products).map(s => ({
    size: s.size, price: s.price, before: s.before,
    ok: allBuyable && _sellerFits(_sellerComboLine(combo, s.size))
  }));
}

function _sellerStockText(p) {
  if (!isDecantPurchasable(p)) return '<span class="seller-out">Agotado</span>';
  if (p.type === 'entero') return `${p.stockQuantity || 0} en stock`;
  if (!p.bottleTotalMl) return 'Sin control de ml';
  return `Quedan ${Math.round(p.bottleRemainingMl || 0)} ml`;
}

// ── Vender ───────────────────────────────────────────────────────────────────

function _sellerRenderSearch() {
  const box = document.getElementById('sellerResults');
  const q = _sNorm(document.getElementById('sellerSearch').value).trim();
  if (!q) {
    box.innerHTML = '<p class="seller-hint">Escribe el nombre o la marca del perfume.</p>';
    return;
  }
  const words = q.split(/\s+/);
  const found = _seller.products
    .filter(p => { const t = _sNorm(`${p.name} ${p.brand}`); return words.every(w => t.includes(w)); })
    .sort((a, b) => Number(isDecantPurchasable(b)) - Number(isDecantPurchasable(a)) || a.name.localeCompare(b.name, 'es'))
    .slice(0, 12);
  if (!found.length) {
    box.innerHTML = '<p class="seller-hint">No encontré ese perfume. Prueba con otra palabra.</p>';
    return;
  }
  box.innerHTML = found.map(p => `
    <div class="seller-prod">
      <div class="seller-prod-head">
        <div>
          <strong>${sanitize(p.name)}</strong>
          <span>${sanitize(p.brand)} · ${_sellerStockText(p)}</span>
        </div>
      </div>
      <div class="seller-sizes">
        ${_sellerOptions(p).map(o => `
          <button type="button" class="seller-size" data-id="${p.id}" data-size="${escapeAttr(o.size)}" ${o.ok ? '' : 'disabled'}>
            <b>${sanitize(o.label || o.size)}</b><span>S/ ${o.price}</span>
          </button>`).join('') || '<span class="seller-hint">Sin precios cargados</span>'}
      </div>
    </div>`).join('');
}

function _sellerRenderCombos() {
  const card = document.getElementById('sellerCombosCard');
  const box  = document.getElementById('sellerCombos');
  if (!card || !box) return;
  card.hidden = !_seller.combos.length;
  box.innerHTML = _seller.combos.map(c => {
    const opts = _sellerComboOptions(c);
    const names = (c.items || []).map(id => _seller.lookup.get(id)).filter(Boolean)
      .map(p => `${sanitize(p.name)} <small>(${sanitize(p.brand)})</small>`).join(' + ');
    return `
    <div class="seller-prod seller-combo">
      <div class="seller-prod-head">
        <div>
          <strong>🎁 ${sanitize(c.title)}</strong>
          <span>${names || 'Sin perfumes'}</span>
        </div>
      </div>
      <div class="seller-sizes">
        ${opts.map(o => `
          <button type="button" class="seller-size seller-combo-size" data-combo="${c.id}" data-size="${escapeAttr(o.size)}" ${o.ok ? '' : 'disabled'}>
            <b>${sanitize(o.size)}</b><span>S/ ${o.price}</span>${o.before > o.price ? `<s>S/ ${o.before}</s>` : ''}
          </button>`).join('') || '<span class="seller-hint">Sin tallas disponibles ahora</span>'}
      </div>
    </div>`;
  }).join('');
}

function _sellerAddCombo(comboId, size) {
  const combo = _seller.combos.find(c => c.id === comboId);
  const opt = combo && _sellerComboOptions(combo).find(o => o.size === size);
  if (!combo || !opt || !opt.ok) return;
  const line = _seller.cart.find(c => c.isCombo && c.comboId === comboId && c.size === size);
  if (line) {
    if (line.quantity >= 10) { showToast('Máximo 10 combos iguales por pedido.'); return; }
    line.quantity++;
  } else {
    _seller.cart.push(_sellerComboLine(combo, size));
  }
  _sellerRenderCart();
  _sellerRenderSearch();
  _sellerRenderCombos();
  showToast(`${combo.title} ${size} agregado`);
}

function _sellerAdd(productId, size) {
  const p = _seller.lookup.get(productId);
  const opt = _sellerOptions(p).find(o => o.size === size);
  if (!p || !opt || !opt.ok) return;
  const line = _seller.cart.find(c => c.productId === productId && c.size === size);
  if (line) line.quantity++;
  else _seller.cart.push({ productId, name: p.name, brand: p.brand, size, price: opt.price, quantity: 1 });
  _sellerRenderCart();
  _sellerRenderSearch();
  _sellerRenderCombos();
  showToast(`${p.name} ${opt.label || size} agregado`);
}

function _sellerRenderCart() {
  const box = document.getElementById('sellerCart');
  const total = _seller.cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const count = _seller.cart.reduce((s, c) => s + c.quantity, 0);
  box.innerHTML = _seller.cart.length ? _seller.cart.map((c, i) => `
    <div class="seller-line">
      <div class="seller-line-info">
        <strong>${sanitize(c.name)}</strong>
        <span>${c.isCombo ? `🎁 ${sanitize(c.composition)}` : sanitize(c.brand)} · ${sanitize(c.size === 'Unidad' ? 'Entero' : c.size)} · S/ ${c.price}</span>
      </div>
      <div class="seller-qty">
        <button type="button" data-i="${i}" data-d="-1" aria-label="Quitar uno">−</button>
        <span>${c.quantity}</span>
        <button type="button" data-i="${i}" data-d="1" aria-label="Agregar uno">+</button>
      </div>
      <strong class="seller-line-total">${_sMoney(c.price * c.quantity)}</strong>
    </div>`).join('')
    : '<p class="seller-hint">Aún no agregas perfumes.</p>';
  document.getElementById('sellerTotal').textContent = _sMoney(total);
  document.getElementById('sellerCount').textContent = count ? `${count} ${count === 1 ? 'producto' : 'productos'}` : 'Sin productos';
  document.getElementById('sellerSubmit').disabled = !count;
}

function _sellerChangeQty(i, d) {
  const c = _seller.cart[i];
  if (!c) return;
  if (d > 0) {
    if (c.isCombo && c.quantity >= 10) { showToast('Máximo 10 combos iguales por pedido.'); return; }
    if (!_sellerFits({ ...c, quantity: 1 })) { showToast('No hay más stock para agregar otro.'); return; }
  }
  c.quantity += d;
  if (c.quantity <= 0) _seller.cart.splice(i, 1);
  _sellerRenderCart();
  _sellerRenderSearch();
  _sellerRenderCombos();
}

async function _sellerSubmit() {
  const btn     = document.getElementById('sellerSubmit');
  const name    = document.getElementById('sellerClientName').value.trim();
  const phone   = document.getElementById('sellerClientPhone').value.trim();
  const dtype   = document.getElementById('sellerDelivery').value;
  const notes   = document.getElementById('sellerNotes').value.trim();
  const total   = _seller.cart.reduce((s, c) => s + c.price * c.quantity, 0);

  if (!_seller.cart.length)   { showToast('Agrega al menos un perfume.'); return; }
  if (name.length < 2)        { showToast('Escribe el nombre del cliente.'); document.getElementById('sellerClientName').focus(); return; }
  if (!_seller.method)        { showToast('Elige cómo te pagó el cliente.'); return; }

  // Revisión rápida de stock antes de mandar (la base igual lo vuelve a revisar)
  const short = stockShortages(_seller.cart, _seller.lookup);
  if (short.length) {
    const s = short[0];
    showToast(s.type === 'ml' ? `No alcanza ${s.name}: quedan ${s.remaining} ml.` : `${s.name} está agotado.`);
    return;
  }

  const method = PAYMENT_METHODS[_seller.method]?.label || _seller.method;
  if (!confirm(`¿Registrar la venta a ${name} por ${_sMoney(total)} (${method})?\n\nQuedará como Pagado y se descontará el stock.`)) return;

  btn.disabled = true;
  btn.textContent = 'Registrando…';
  const row = {
    id:             generateOrderId(),
    customer_name:  name,
    customer_phone: phone,
    delivery_type:  dtype,
    notes,
    // Precios y contenido de combos los vuelve a poner la base (guardia de precios)
    items: _seller.cart.map(c => c.isCombo ? {
      productId: c.productId, isCombo: true, comboId: c.comboId, productName: c.name, brand: c.brand,
      size: c.size, price: c.price, quantity: c.quantity, comboItems: c.comboItems
    } : {
      productId: c.productId, productName: c.name, brand: c.brand,
      size: c.size, price: c.price, quantity: c.quantity
    }),
    total,
    status:         'pagado',
    payment_method: _seller.method
  };
  try {
    // Promise.resolve: la consulta de Supabase es "thenable" pero no una promesa
    // completa (no tiene .finally, que usa withTimeout)
    const { data, error } = await withTimeout(Promise.resolve(db.from('pedidos').insert(row).select('id, total').single()), 20000, 'el registro del pedido');
    if (error) throw new Error(error.message || error.code);
    _seller.cart = [];
    _seller.method = null;
    ['sellerClientName', 'sellerClientPhone', 'sellerNotes', 'sellerSearch'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('sellerDelivery').value = 'recojo';
    document.querySelectorAll('#sellerSection .seller-pay').forEach(b => b.classList.remove('active'));
    showToast(`✅ Venta registrada · ${_sMoney(data?.total ?? total)}`);
    await Promise.all([_sellerLoadProducts(), _sellerLoadOrders()]);
    _sellerRenderAll();
    _sellerShow('pedidos');
  } catch (err) {
    console.error('[MICHT] Vendedora: registrar pedido', err);
    alert('⚠ No se registró la venta: ' + (err.message || 'error de conexión'));
    // El stock pudo cambiar: refrescar
    await _sellerLoadProducts();
    _sellerRenderSearch();
    _sellerRenderCombos();
  } finally {
    btn.textContent = 'Registrar venta';
    btn.disabled = !_seller.cart.length;
  }
}

// ── Mis pedidos ──────────────────────────────────────────────────────────────

function _sellerOrderState(o) {
  if (o.anuladoVendedoraAt) return { cls: 'cancelado', label: 'Anulado por ti' };
  if (o.status === 'cancelado') return { cls: 'cancelado', label: 'Cancelado por la tienda' };
  if (o.status === 'entregado' || o.status === 'enviado') return { cls: 'entregado', label: 'Entregado' };
  return { cls: 'pagado', label: 'Registrado' };
}
const _sellerCanCancel = o => o.status === 'pagado' && !o.rendidoAt && !o.anuladoVendedoraAt;
const _sellerCounts    = o => o.status !== 'cancelado';
const _sellerOwes      = o => _sellerCounts(o) && !o.rendidoAt;

function _sellerRenderOrders() {
  const box = document.getElementById('sellerOrders');
  let list = _seller.orders;
  if (_seller.ordersFilter === 'deber')     list = list.filter(_sellerOwes);
  if (_seller.ordersFilter === 'anulados')  list = list.filter(o => o.status === 'cancelado');
  if (!list.length) {
    box.innerHTML = `<p class="seller-hint">${_seller.orders.length ? 'No hay pedidos con ese filtro.' : 'Todavía no registras ventas.'}</p>`;
    return;
  }
  box.innerHTML = list.map(o => {
    const st = _sellerOrderState(o);
    const pay = (o.payments || [])[0];
    const money = !_sellerCounts(o) ? ''
      : o.rendidoAt ? `<span class="seller-money done">✓ Entregado a la tienda el ${_sDate(o.rendidoAt)}</span>`
      : `<span class="seller-money owe">💰 Por entregar a la tienda</span>`;
    return `
    <article class="seller-order ${o.status === 'cancelado' ? 'is-cancel' : ''}">
      <header>
        <span>${_sDate(o.date)} · ${_sTime(o.date)}</span>
        <span class="seller-badge ${st.cls}">${st.label}</span>
      </header>
      <strong class="seller-order-client">${sanitize(o.customerName || '—')}</strong>
      <ul>${(o.items || []).map(i => `<li>${i.comboComposition ? '🎁 ' : ''}${sanitize(i.productName || '')} <small>${sanitize(i.size === 'Unidad' ? 'Entero' : i.size || '')} ×${parseInt(i.quantity) || 1}</small>${i.comboComposition ? `<br><small>${sanitize(i.comboComposition)}</small>` : ''}</li>`).join('')}</ul>
      <footer>
        <div>
          <strong>${_sMoney(o.total)}</strong>
          ${pay?.method ? `<small>${PAYMENT_METHODS[pay.method]?.icon || ''} ${PAYMENT_METHODS[pay.method]?.label || ''}</small>` : ''}
        </div>
        ${money}
      </footer>
      ${_sellerCanCancel(o) ? `<button type="button" class="seller-cancel" data-id="${escapeAttr(o.id)}">Anular esta venta</button>` : ''}
    </article>`;
  }).join('');
}

async function _sellerCancel(id) {
  const o = _seller.orders.find(x => x.id === id);
  if (!o) return;
  if (!confirm(`¿Anular la venta a ${o.customerName} por ${_sMoney(o.total)}?\n\nEl stock vuelve y la tienda verá que la anulaste.`)) return;
  const { error } = await db.rpc('vendedora_anular_pedido', { p_id: id });
  if (error) { alert('⚠ ' + (error.message || 'No se pudo anular.')); return; }
  showToast('Venta anulada. El stock ya volvió.');
  await Promise.all([_sellerLoadProducts(), _sellerLoadOrders()]);
  _sellerRenderAll();
}

// ── Stock ────────────────────────────────────────────────────────────────────

function _sellerRenderStock() {
  const box = document.getElementById('sellerStock');
  const q = _sNorm(_seller.stockSearch).trim();
  const words = q ? q.split(/\s+/) : [];
  const f = _seller.stockFilter;
  const low = p => p.type !== 'entero' && p.bottleTotalMl > 0 && isDecantPurchasable(p) && (p.bottleRemainingMl || 0) < 20;
  const list = _seller.products.filter(p => {
    if (words.length && !words.every(w => _sNorm(`${p.name} ${p.brand}`).includes(w))) return false;
    if (f === 'poco')     return low(p);
    if (f === 'agotado')  return !isDecantPurchasable(p);
    if (f !== 'all')      return p.type === f;
    return true;
  }).sort((a, b) => a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es'));

  document.getElementById('sellerStockCount').textContent = `${list.length} perfumes`;
  box.innerHTML = list.length ? list.map(p => {
    const pct = p.type !== 'entero' && p.bottleTotalMl > 0 ? Math.max(0, Math.min(100, Math.round((p.bottleRemainingMl || 0) / p.bottleTotalMl * 100))) : null;
    const prices = Object.entries(p.sizes || {})
      .filter(([s, v]) => (parseFloat(v) || 0) > 0 && (p.type === 'entero' || /^\d/.test(s)))
      .map(([s, v]) => `${sanitize(s)} S/ ${v}`).join(' · ');
    return `
    <div class="seller-stock-row ${isDecantPurchasable(p) ? '' : 'is-out'}">
      <div class="seller-stock-top">
        <div><strong>${sanitize(p.name)}</strong><span>${sanitize(p.brand)}</span></div>
        <em>${_sellerStockText(p)}</em>
      </div>
      ${pct !== null ? `<div class="seller-bar ${low(p) ? 'low' : ''}"><span style="width:${pct}%"></span></div>` : ''}
      <small>${prices || 'Sin precios cargados'}</small>
    </div>`;
  }).join('') : '<p class="seller-hint">No hay perfumes con ese filtro.</p>';
}

// ── Mis ventas ───────────────────────────────────────────────────────────────

function _sellerPeriodRange(period) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'hoy')    return [start, null];
  if (period === 'semana') { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return [start, null]; }
  if (period === 'mes')    return [new Date(now.getFullYear(), now.getMonth(), 1), null];
  return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
}

function _sellerUnits(o) {
  return flattenOrderItems(o.items).reduce((s, i) => s + (parseInt(i.quantity) || 1), 0);
}

function _sellerRenderSales() {
  const [from, to] = _sellerPeriodRange(_seller.period);
  const inPeriod = _seller.orders.filter(o => {
    const t = new Date(o.date);
    return _sellerCounts(o) && t >= from && (!to || t < to);
  });
  const sold  = inPeriod.reduce((s, o) => s + o.total, 0);
  const units = inPeriod.reduce((s, o) => s + _sellerUnits(o), 0);

  // Dinero que tiene ella (de cualquier fecha) — lo que debe entregar
  const owes = _seller.orders.filter(_sellerOwes);
  const owesTotal = owes.reduce((s, o) => s + orderPaidAmount(o), 0);
  const byMethod = {};
  owes.forEach(o => orderPayments(o).forEach(p => { byMethod[p.method || 'otro'] = (byMethod[p.method || 'otro'] || 0) + p.amount; }));
  const delivered = inPeriod.filter(o => o.rendidoAt).reduce((s, o) => s + o.total, 0);

  // Por día
  const days = new Map();
  inPeriod.forEach(o => {
    const k = new Date(o.date).toLocaleDateString('en-CA');
    const d = days.get(k) || { date: o.date, n: 0, total: 0, units: 0 };
    d.n++; d.total += o.total; d.units += _sellerUnits(o);
    days.set(k, d);
  });

  document.getElementById('sellerSales').innerHTML = `
    <div class="seller-kpis">
      <div><span>Vendido</span><strong>${_sMoney(sold)}</strong></div>
      <div><span>Pedidos</span><strong>${inPeriod.length}</strong></div>
      <div><span>Productos</span><strong>${units}</strong></div>
    </div>

    <div class="seller-owe-card ${owesTotal > 0 ? '' : 'is-zero'}">
      <span>Tienes por entregar a la tienda</span>
      <strong>${_sMoney(owesTotal)}</strong>
      <small>${owes.length ? `${owes.length} ${owes.length === 1 ? 'venta' : 'ventas'} · ` + Object.entries(byMethod).map(([m, v]) => `${PAYMENT_METHODS[m]?.icon || '💵'} ${PAYMENT_METHODS[m]?.label || 'Otro'} ${_sMoney(v)}`).join(' · ') : 'Estás al día 🎉'}</small>
    </div>
    ${delivered > 0 ? `<p class="seller-hint">Ya entregaste ${_sMoney(delivered)} de este periodo.</p>` : ''}

    <h3 class="seller-subtitle">Por día</h3>
    ${days.size ? `<div class="seller-days">${[...days.values()].map(d => `
      <div><span>${new Date(d.date).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
        <small>${d.n} ${d.n === 1 ? 'pedido' : 'pedidos'} · ${d.units} prod.</small>
        <strong>${_sMoney(d.total)}</strong></div>`).join('')}</div>`
      : '<p class="seller-hint">Sin ventas en este periodo.</p>'}`;
}

// ── Eventos ──────────────────────────────────────────────────────────────────

function _sellerBindEvents() {
  const app = document.getElementById('sellerSection');
  app.querySelectorAll('.seller-tab').forEach(t => t.addEventListener('click', () => _sellerShow(t.dataset.view)));

  document.getElementById('sellerSearch').addEventListener('input', _sellerRenderSearch);
  document.getElementById('sellerResults').addEventListener('click', e => {
    const b = e.target.closest('.seller-size');
    if (b && !b.disabled) _sellerAdd(parseInt(b.dataset.id), b.dataset.size);
  });
  document.getElementById('sellerCombos').addEventListener('click', e => {
    const b = e.target.closest('.seller-combo-size');
    if (b && !b.disabled) _sellerAddCombo(parseInt(b.dataset.combo), b.dataset.size);
  });
  document.getElementById('sellerCart').addEventListener('click', e => {
    const b = e.target.closest('.seller-qty button');
    if (b) _sellerChangeQty(parseInt(b.dataset.i), parseInt(b.dataset.d));
  });
  app.querySelectorAll('.seller-pay').forEach(b => b.addEventListener('click', () => {
    _seller.method = b.dataset.method;
    app.querySelectorAll('.seller-pay').forEach(x => x.classList.toggle('active', x === b));
  }));
  document.getElementById('sellerSubmit').addEventListener('click', _sellerSubmit);

  app.querySelectorAll('[data-orders-filter]').forEach(b => b.addEventListener('click', () => {
    _seller.ordersFilter = b.dataset.ordersFilter;
    app.querySelectorAll('[data-orders-filter]').forEach(x => x.classList.toggle('active', x === b));
    _sellerRenderOrders();
  }));
  document.getElementById('sellerOrders').addEventListener('click', e => {
    const b = e.target.closest('.seller-cancel');
    if (b) _sellerCancel(b.dataset.id).catch(console.error);
  });

  document.getElementById('sellerStockSearch').addEventListener('input', e => { _seller.stockSearch = e.target.value; _sellerRenderStock(); });
  app.querySelectorAll('[data-stock-filter]').forEach(b => b.addEventListener('click', () => {
    _seller.stockFilter = b.dataset.stockFilter;
    app.querySelectorAll('[data-stock-filter]').forEach(x => x.classList.toggle('active', x === b));
    _sellerRenderStock();
  }));

  app.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {
    _seller.period = b.dataset.period;
    app.querySelectorAll('[data-period]').forEach(x => x.classList.toggle('active', x === b));
    _sellerRenderSales();
  }));

  document.getElementById('sellerRefresh').addEventListener('click', async () => {
    await Promise.all([_sellerLoadProducts(), _sellerLoadOrders()]);
    _sellerRenderAll();
    showToast('Actualizado ✓');
  });
  document.getElementById('sellerLogout').addEventListener('click', async () => {
    await db.auth.signOut();
    location.reload();
  });
}
