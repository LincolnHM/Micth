// ─── Convertir formato Supabase ↔ JavaScript ──────────────────────────────────
//
// Los pedidos los puede insertar CUALQUIER visitante (el checkout no exige
// cuenta), así que todo lo que llega de la tabla `pedidos` se trata como dato
// no confiable: aquí se normaliza a tipos seguros (números reales, estados de
// una lista fija, textos con largo máximo) antes de que lo toque cualquier
// pantalla del panel. Los textos igual se escapan al dibujarlos (sanitize()).

const _ORDER_STATUSES = ['pendiente', 'separado', 'pagado', 'cancelado', 'enviado', 'entregado'];
const _PAY_METHODS    = ['yape', 'plin', 'efectivo', 'transferencia'];

const _str = (v, max) => String(v ?? '').slice(0, max);
const _num = (v, def = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def; };
const _money = v => Math.round(Math.max(0, Math.min(_num(v), 1000000)) * 100) / 100;

// Pagos (abonos) del pedido — ver orderPayments() en data.js
function _cleanPayments(list, fallbackDate) {
  return (Array.isArray(list) ? list : [])
    .slice(0, 50)
    .map((p, i) => {
      if (!p || typeof p !== 'object') return null;
      const d = new Date(p.date);
      return {
        id:     _str(p.id, 40) || `p${i}`,
        amount: _money(p.amount),
        method: _PAY_METHODS.includes(p.method) ? p.method : null,
        date:   isNaN(d) ? fallbackDate : d.toISOString(),
        note:   _str(p.note, 120)
      };
    })
    .filter(p => p && p.amount > 0);
}

function _newPaymentId() {
  const bytes = new Uint8Array(4);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return 'P' + Date.now().toString(36).toUpperCase() + Array.from(bytes, b => (b % 36).toString(36)).join('').toUpperCase();
}

// El método con más dinero: se guarda también en payment_method (columna vieja)
function _mainMethod(payments) {
  const byMethod = {};
  payments.forEach(p => { if (p.method) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });
  return Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

const _missingColumn = (err, col) =>
  !!err && (err.code === '42703' || err.code === 'PGRST204') && (err.message || '').includes(col);

const PAYMENTS_SQL_HINT = 'Para guardar adelantos y pagos divididos falta un paso en Supabase: pega el archivo backend/supabase/sql/2026-10-19-pagos-por-pedido.sql en SQL Editor y dale Run.';

function _cleanOrderItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(i => i && typeof i === 'object')
    .slice(0, 60)
    .map(i => {
      const pid = parseInt(i.productId);
      const out = {
        productId:   Number.isInteger(pid) ? pid : null,
        productName: _str(i.productName, 200),
        brand:       _str(i.brand, 120),
        size:        _str(i.size, 30),
        price:       Math.max(0, _num(i.price)),
        quantity:    Math.max(1, Math.min(99, parseInt(i.quantity) || 1))
      };
      if (i.isCombo === true) {
        const cid = parseInt(i.comboId);
        out.isCombo          = true;
        out.comboId          = Number.isInteger(cid) ? cid : null;
        out.comboComposition = _str(i.comboComposition, 500);
        out.comboItems = (Array.isArray(i.comboItems) ? i.comboItems : [])
          .filter(ci => ci && typeof ci === 'object')
          .slice(0, 6)
          .map(ci => {
            const cpid = parseInt(ci.productId);
            return {
              productId: Number.isInteger(cpid) ? cpid : null,
              size:      _str(ci.size, 30),
              qty:       Math.max(1, Math.min(10, parseInt(ci.qty) || 1)),
              name:      _str(ci.name, 200),
              brand:     _str(ci.brand, 120)
            };
          });
      }
      return out;
    });
}

// ─── Tipo de entrega ──────────────────────────────────────────────────────────
// recojo (tienda en Soritor) · delivery (a domicilio dentro de Soritor) · envio (Shalom)
const DELIVERY_TYPES = {
  recojo:   { icon: '🏪', short: 'Recojo',   long: 'Recojo en tienda' },
  delivery: { icon: '🛵', short: 'Delivery', long: 'Delivery en Soritor' },
  envio:    { icon: '📦', short: 'Shalom',   long: 'Envío Shalom' }
};
function deliveryInfo(type) { return DELIVERY_TYPES[type] || DELIVERY_TYPES.recojo; }

// 'delivery' es nuevo (2026-09-26). Si la base aún tiene el trigger de
// validar-pedidos anterior, lo guarda como 'recojo'; la nota "DELIVERY SORITOR"
// que pone la tienda permite reconocerlo igual.
function _deliveryTypeFromRow(row) {
  if (row.delivery_type === 'envio' || row.delivery_type === 'delivery') return row.delivery_type;
  return /^DELIVERY SORITOR/.test(row.notes || '') ? 'delivery' : 'recojo';
}

function orderFromDB(row) {
  return {
    id:            _str(row.id, 80),
    customerName:  _str(row.customer_name, 200),
    customerPhone: _str(row.customer_phone, 40),
    customerDni:   _str(row.customer_dni, 20),
    deliveryType:  _deliveryTypeFromRow(row),
    department:    _str(row.department, 80),
    province:      _str(row.province, 80),
    shalomOffice:  _str(row.shalom_office, 300),
    notes:         _str(row.notes, 600),
    items:         _cleanOrderItems(row.items),
    total:         Math.max(0, Math.min(_num(row.total), 1000000)),
    status:        _ORDER_STATUSES.includes(row.status) ? row.status : 'pendiente',
    paymentMethod: _PAY_METHODS.includes(row.payment_method) ? row.payment_method : null,
    payments:      _cleanPayments(row.payments, row.created_at),
    date:          row.created_at,
    updatedAt:     row.updated_at
  };
}

function orderToDB(order) {
  return {
    id:             order.id,
    customer_name:  order.customerName  || '',
    customer_phone: order.customerPhone || '',
    customer_dni:   order.customerDni   || '',
    delivery_type:  order.deliveryType  || 'recojo',
    department:     order.department    || '',
    province:       order.province      || '',
    shalom_office:  order.shalomOffice  || '',
    notes:          order.notes         || '',
    items:          order.items         || [],
    total:          order.total         || 0,
    status:         order.status        || 'pendiente',
    payment_method: order.paymentMethod || null
  };
}

// ─── Generar ID único para pedido ─────────────────────────────────────────────
// ORD-AAAAMMDD-HHMM + 3 caracteres al azar (36³ = 46 656 combinaciones por
// minuto). Antes eran 2 dígitos: con 2 pedidos en el mismo minuto había 1 de 100
// de chocar, y el segundo se perdía por llave duplicada.

function generateOrderId() {
  const now = new Date();
  const p2  = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}`;
  const time = `${p2(now.getHours())}${p2(now.getMinutes())}`;
  const bytes = new Uint8Array(3);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  const rand = Array.from(bytes, b => (b % 36).toString(36)).join('').toUpperCase();
  return `ORD-${date}-${time}${rand}`;
}

function _notifyOrder(msg) {
  const fn = typeof showToast === 'function' ? showToast
           : typeof showCartToast === 'function' ? showCartToast : null;
  if (fn) fn(msg);
}

// ─── API de pedidos (async, usa Supabase si está configurado) ─────────────────

const CloudOrders = {

  _lastFetchFromSupabase: false,
  _lastFetchError: null,
  _lastFetchCount: 0,
  _divergent: [],          // pedidos cuyo estado local no coincidía con la base

  async getAll() {
    if (db) {
      const { data, error } = await db
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        console.error('Supabase error:', error?.code, error?.message);
        this._lastFetchFromSupabase = false;
        this._lastFetchError = `${error.code || ''}: ${error.message || 'error desconocido'}`;
        this._lastFetchCount = 0;
        return this._localGetAll();
      }
      const supabaseOrders = data.map(orderFromDB);
      const localOrders    = Orders.getAll();

      // La base de datos manda. Antes el estado guardado en este navegador le ganaba
      // al de la base, y así un cambio de estado que NO llegó a Supabase se veía
      // "pagado" aquí y "pendiente" en el celular — sin descontar stock. Ahora se
      // muestra el de la base y se avisa de cada diferencia.
      const remoteStatus = new Map(supabaseOrders.map(o => [o.id, o.status]));
      this._divergent = localOrders
        .filter(o => remoteStatus.has(o.id) && remoteStatus.get(o.id) !== o.status)
        .map(o => ({ id: o.id, local: o.status, remote: remoteStatus.get(o.id) }));
      if (this._divergent.length) {
        console.warn('[MICHT] Estados distintos entre este navegador y Supabase (se usa el de Supabase):', this._divergent);
        Orders.save(localOrders.map(o => remoteStatus.has(o.id) ? { ...o, status: remoteStatus.get(o.id) } : o));
      }

      // Incluir pedidos en localStorage que aún no llegaron a Supabase.
      // Los marcados con _pendingSync (insert falló) se mantienen indefinidamente.
      const supabaseIds  = new Set(supabaseOrders.map(o => o.id));
      const tenMinAgo    = Date.now() - 10 * 60 * 1000;
      const pendingLocal = localOrders.filter(o =>
        !supabaseIds.has(o.id) && (o._pendingSync || new Date(o.date).getTime() > tenMinAgo)
      );
      // Limpiar zombies del localStorage (órdenes que ya no están en Supabase y son antiguas)
      // Solo limpiar si Supabase devolvió datos reales — evita borrar datos cuando hay error de auth/red
      const zombies = supabaseOrders.length > 0
        ? localOrders.filter(o =>
            !supabaseIds.has(o.id) &&
            !o._pendingSync &&
            new Date(o.date).getTime() <= tenMinAgo
          )
        : [];
      if (zombies.length) Orders.save(Orders.getAll().filter(o => !zombies.some(z => z.id === o.id)));
      this._lastFetchFromSupabase = true;
      this._lastFetchError = null;
      this._lastFetchCount = supabaseOrders.length;

      // Pedidos guardados solo aquí (falló el envío a Supabase): reintentar en segundo plano
      if (pendingLocal.some(o => o._pendingSync)) this.retryPending().catch(() => {});

      if (!pendingLocal.length) return supabaseOrders;
      return [...supabaseOrders, ...pendingLocal]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    this._lastFetchFromSupabase = false;
    return this._localGetAll();
  },

  async getById(id) {
    if (db) {
      const { data, error } = await db
        .from('pedidos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return this._localGetById(id);
      return orderFromDB(data);
    }
    return this._localGetById(id);
  },

  // ── Crear pedido ────────────────────────────────────────────────────────────
  // IMPORTANTE (celular): el checkout abre WhatsApp justo después de llamar a esta
  // función, y en el móvil eso manda la página al fondo. Por eso:
  //   1. el pedido se guarda primero en este navegador, marcado _pendingSync;
  //   2. el envío a Supabase es UNA sola petición (`keepalive`, que el navegador
  //      termina aunque la página se cierre) y arranca en el mismo instante;
  //   3. si aun así no llegó, _pendingSync queda puesto y retryPending() lo
  //      reenvía en la próxima visita (la llave duplicada se toma como "ya llegó").
  async create(order) {
    const newOrder = {
      ...order,
      // La tienda genera el id antes (para mostrarlo en el WhatsApp y en la
      // pantalla de "pedido enviado"); el admin no lo pasa y se genera aquí.
      id:     /^ORD-[A-Za-z0-9-]{6,40}$/.test(order.id || '') ? order.id : generateOrderId(),
      date:   new Date().toISOString(),
      status: order.status || 'pendiente',
      _pendingSync: !!db
    };
    try { this._localCreate(newOrder); } catch {}
    if (!db) return newOrder.id;

    const res = await this._pushOrder(newOrder);
    if (res.ok) {
      this._markSynced(newOrder.id, res.total);
    } else {
      console.error('[MICHT] No se pudo registrar el pedido en Supabase:', res.status, res.code, res.message);
      if (res.rejected) this._markRejected(newOrder.id);
      _notifyOrder(res.rejected
        ? '⚠ ' + (res.message || 'No se pudo registrar el pedido.')
        : '⚠ No se pudo registrar el pedido en línea todavía; se reintentará solo. Tu pedido igual llega por WhatsApp.');
    }
    return newOrder.id;
  },

  // Envía un pedido a Supabase. Devuelve { ok, ... }; nunca lanza.
  //   rejected: el servidor lo rechazó por datos inválidos (no tiene sentido reintentar)
  async _pushOrder(order) {
    const row = orderToDB(order);
    try {
      // Ruta opcional: Edge Function create-order (solo si USE_EDGE_CREATE_ORDER = true)
      if (typeof USE_EDGE_CREATE_ORDER !== 'undefined' && USE_EDGE_CREATE_ORDER) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey':        SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ ...order, id: order.id })
        });
        if (res.ok) {
          const serverOrder = await res.json().catch(() => null);
          return { ok: true, total: serverOrder?.total };
        }
        if (res.status === 400 || res.status === 429) {
          const errBody = await res.json().catch(() => ({}));
          return { ok: false, rejected: true, status: res.status, message: errBody.error };
        }
        // otro error de la función → cae al envío directo de abajo
      }

      const post = async payload => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey':        SUPABASE_ANON_KEY,
            'Prefer':        'return=minimal'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({}));
        return { ok: false, status: res.status, code: body.code, message: body.message };
      };

      let r = await post(row);
      // Columna payment_method todavía no creada en esa base → reintentar sin ella
      if (!r.ok && (r.code === '42703' || r.code === 'PGRST204') && /payment_method/.test(r.message || '')) {
        const { payment_method, ...fallback } = row;
        r = await post(fallback);
      }
      // Llave duplicada: el pedido ya estaba en la base (reintento de un envío anterior)
      if (!r.ok && (r.code === '23505' || r.status === 409)) return { ok: true, duplicate: true };
      // 4xx que no es de sesión/frecuencia = la base lo rechazó por sus reglas
      if (!r.ok && r.status >= 400 && r.status < 500 && ![401, 403, 408, 429].includes(r.status)) r.rejected = true;
      return r;
    } catch (err) {
      return { ok: false, network: true, message: err.message };
    }
  },

  // Reenvía los pedidos guardados solo en este navegador. Devuelve cuántos llegaron.
  async retryPending() {
    if (!db || this._retrying) return 0;
    this._retrying = true;
    let sent = 0;
    try {
      for (const o of Orders.getAll().filter(x => x._pendingSync)) {
        const res = await this._pushOrder(o);
        if (res.ok) { this._markSynced(o.id, res.total); sent++; }
        else if (res.rejected) this._markRejected(o.id);
      }
    } finally { this._retrying = false; }
    return sent;
  },

  // Marca un pedido local como "pendiente de sincronizar" — evita que se
  // limpie como zombie mientras no se confirme que llegó a Supabase.
  _markPending(id) {
    try {
      const stored = Orders.getAll();
      const idx = stored.findIndex(o => o.id === id);
      if (idx !== -1) { stored[idx]._pendingSync = true; Orders.save(stored); }
    } catch {}
  },

  // Marca un pedido local como sincronizado y adopta el total autoritativo
  // que devolvió el servidor (puede diferir un poco si el precio cambió).
  _markSynced(id, serverTotal) {
    try {
      const stored = Orders.getAll();
      const idx = stored.findIndex(o => o.id === id);
      if (idx !== -1) {
        if (typeof serverTotal === 'number') stored[idx].total = serverTotal;
        delete stored[idx]._pendingSync;
        delete stored[idx]._rejected;
        Orders.save(stored);
      }
    } catch {}
  },

  // La base rechazó el pedido: dejar de reintentarlo.
  _markRejected(id) {
    try {
      const stored = Orders.getAll();
      const idx = stored.findIndex(o => o.id === id);
      if (idx !== -1) { delete stored[idx]._pendingSync; stored[idx]._rejected = true; Orders.save(stored); }
    } catch {}
  },

  // ── Stock ───────────────────────────────────────────────────────────────────
  // Aplica al inventario lo que consumen `consumeItems` y devuelve lo que
  // devuelven `restoreItems` (uno de los dos puede ir vacío), sumando por perfume
  // y guardando cada uno con CloudProducts.mutate (lectura fresca + escritura
  // condicional). Si un perfume falla, deshace los ya aplicados y lanza el error:
  // nunca deja el inventario a medias.
  async _applyStockDelta(consumeItems, restoreItems) {
    const all    = await CloudProducts.getAll();
    const lookup = new Map(all.map(p => [p.id, p]));
    const cons = orderStockNeeds(consumeItems, lookup);
    const rest = orderStockNeeds(restoreItems, lookup);

    const net = new Map();
    cons.needs.forEach((n, pid) => net.set(pid, { ...n }));
    rest.needs.forEach((n, pid) => {
      const c = net.get(pid) || { productId: pid, label: n.label, ml: 0, units: 0, enteroUnits: 0 };
      c.ml -= n.ml; c.units -= n.units; c.enteroUnits -= n.enteroUnits;
      net.set(pid, c);
    });

    const applied = [];
    const summary = [];
    const fail = async (n, res) => {
      const stuck = [];
      for (const done of applied.reverse()) {
        const undo = await CloudProducts.mutate(done.productId, p => stockPatch(p, {
          ml: -done.ml, units: -done.units, enteroUnits: -done.enteroUnits
        })).catch(() => ({ ok: false }));
        if (!undo.ok) stuck.push(done.label);
      }
      let why;
      if (res.reason === 'missing-column') {
        why = `a la tabla productos le falta la columna ${res.columns.join(', ')} (corre el SQL de backend/supabase/sql/ que la crea)`;
      } else if (res.reason === 'not-found') {
        why = 'el perfume ya no existe';
      } else if (res.error) {
        why = res.error.message || res.error.code;
      } else {
        why = 'otro dispositivo lo modificó al mismo tiempo o tu sesión de admin venció — cierra sesión, vuelve a entrar e inténtalo de nuevo';
      }
      const stuckNote = stuck.length ? ` ⚠ Además NO se pudo deshacer el cambio ya hecho en: ${stuck.join(', ')} — revisa su stock a mano.` : '';
      throw new Error(`No se pudo actualizar el stock de «${n.label}»: ${why}. No se cambió el estado del pedido.${stuckNote}`);
    };

    for (const n of net.values()) {
      if (!n.ml && !n.units && !n.enteroUnits) continue;
      const res = await CloudProducts.mutate(n.productId, p => stockPatch(p, n));
      if (!res.ok) await fail(n, res);
      if (res.patch) {
        applied.push(n);
        const parts = [];
        if (n.ml)          parts.push(`${n.ml > 0 ? '−' : '+'}${Math.abs(n.ml)} ml`);
        if (n.units)       parts.push(`${n.units > 0 ? '−' : '+'}${Math.abs(n.units)} u.`);
        if (n.enteroUnits) parts.push(`${n.enteroUnits > 0 ? '−' : '+'}${Math.abs(n.enteroUnits)} u. (entero)`);
        summary.push(`${n.label} ${parts.join(' ')}`);
      }
    }
    return { summary, skipped: [...new Set([...cons.skipped, ...rest.skipped])] };
  },

  // ── Cambiar estado / pagos ──────────────────────────────────────────────────
  // Todo cambio de estado o de pagos pasa por aquí, una sola vez y contra la base:
  //   1. se lee la fila fresca y plan(order) dice qué cambia —
  //      { status, payments?, paymentMethod?, fallback? }— o null si no hay nada que hacer;
  //   2. se reclama el cambio "solo si el pedido sigue como lo leímos" (mismo estado y
  //      misma hora de edición): dos dispositivos no pueden descontar el mismo pedido
  //      dos veces ni pisarse los pagos;
  //   3. entrar a un estado que descuenta stock (separado/pagado) lo DESCUENTA; salir de
  //      él (a pendiente o cancelado) lo DEVUELVE. Si el stock falla, se deshace el paso 2.
  // Devuelve { stock: ['Marca Perfume −10 ml', …], skipped: […], order }. Lanza si algo
  // falla (antes fallaba en silencio y el pedido quedaba "pagado" sin descontar).
  async _commit(id, plan) {
    const result = { stock: [], skipped: [], order: null };
    const pick = c => {
      const saved = { status: c.status };
      if (c.payments !== undefined)      saved.payments      = c.payments;
      if (c.paymentMethod !== undefined) saved.paymentMethod = c.paymentMethod;
      return saved;
    };

    if (!db) {
      const local = Orders.getById(id);
      if (!local) throw new Error('El pedido ya no existe.');
      const order  = { ...local, payments: _cleanPayments(local.payments, local.date) };
      const change = plan(order);
      if (!change) { result.order = order; return result; }
      if (isPaidStatus(order.status) !== isPaidStatus(change.status)) {
        const consume = isPaidStatus(change.status);
        const r = await this._applyStockDelta(consume ? order.items : [], consume ? [] : order.items);
        result.stock = r.summary; result.skipped = r.skipped;
      }
      this._cacheLocal(id, pick(change));
      result.order = { ...order, ...pick(change) };
      return result;
    }

    // 1) La fila fresca de la base
    let { data: row, error: readErr } = await db.from('pedidos').select('*').eq('id', id).maybeSingle();
    if (readErr) throw new Error('No se pudo leer el pedido: ' + (readErr.message || readErr.code));
    if (!row) {
      // Pedido que solo existe en este navegador (no llegó a subir): subirlo primero
      const local = Orders.getById(id);
      if (!local) throw new Error('El pedido ya no existe.');
      const pushed = await this._pushOrder(local);
      if (!pushed.ok) throw new Error('Este pedido solo existe en este navegador y no se pudo subir a Supabase: ' + (pushed.message || 'sin conexión') + '.');
      this._markSynced(id);
      ({ data: row } = await db.from('pedidos').select('*').eq('id', id).maybeSingle());
      if (!row) throw new Error('No se pudo encontrar el pedido en Supabase.');
    }
    const order = orderFromDB(row);
    let change  = plan(order);
    if (!change) { result.order = order; return result; }

    // 2) Reclamar el cambio (solo si el pedido sigue como lo leímos)
    const prevRaw = row.status;
    const toPatch = c => {
      const p = { status: c.status, updated_at: new Date().toISOString() };
      if (c.payments !== undefined)      p.payments       = c.payments;
      if (c.paymentMethod !== undefined) p.payment_method = c.paymentMethod;
      return p;
    };
    const claim = payload => {
      let q = db.from('pedidos').update(payload).eq('id', id);
      q = prevRaw == null ? q.is('status', null) : q.eq('status', prevRaw);
      q = row.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', row.updated_at);
      return q.select('id');
    };
    let patch = toPatch(change);
    let claimed, claimErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      ({ data: claimed, error: claimErr } = await claim(patch));
      if ('payments' in patch && _missingColumn(claimErr, 'payments')) {
        // La base aún no tiene la columna de pagos: solo se puede marcar "pagado" de una vez
        if (!change.fallback) throw new Error(PAYMENTS_SQL_HINT);
        change = change.fallback;
        patch  = toPatch(change);
      } else if ('payment_method' in patch && _missingColumn(claimErr, 'payment_method')) {
        delete patch.payment_method;
      } else break;
    }
    if (claimErr) throw new Error('No se pudo actualizar el pedido: ' + (claimErr.message || claimErr.code));
    if (!claimed || !claimed.length) {
      throw new Error('No se pudo guardar el cambio: el pedido fue modificado desde otro dispositivo o tu sesión de admin venció. Recarga la lista (o cierra sesión y vuelve a entrar).');
    }

    // 3) Stock — solo al entrar o salir de un estado que lo descuenta
    if (isPaidStatus(prevRaw) !== isPaidStatus(change.status)) {
      const consume = isPaidStatus(change.status);
      try {
        const r = await this._applyStockDelta(consume ? order.items : [], consume ? [] : order.items);
        result.stock = r.summary; result.skipped = r.skipped;
      } catch (err) {
        const undo = { status: prevRaw ?? 'pendiente', updated_at: new Date().toISOString() };
        if ('payments' in patch)       undo.payments       = row.payments ?? [];
        if ('payment_method' in patch) undo.payment_method = row.payment_method ?? null;
        try { await db.from('pedidos').update(undo).eq('id', id).eq('status', change.status); } catch {}
        throw err;
      }
    }

    const saved = pick({
      status:        change.status,
      payments:      patch.payments,
      paymentMethod: 'payment_method' in patch ? patch.payment_method : undefined
    });
    this._cacheLocal(id, saved);
    result.order = { ...order, ...saved, updatedAt: patch.updated_at };
    return result;
  },

  // Refleja un cambio en la copia de este navegador (si la tiene)
  _cacheLocal(id, fields) {
    try {
      const stored = Orders.getAll();
      const idx = stored.findIndex(o => o.id === id);
      if (idx === -1) return;
      stored[idx] = { ...stored[idx], ...fields, updatedAt: new Date().toISOString() };
      Orders.save(stored);
    } catch {}
  },

  // Qué cambia al registrar `entries` ([{ amount, method, note }]) en un pedido.
  // El estado sale de lo pagado: una parte → separado, todo → pagado.
  _planPayments(order, entries) {
    if (order.status === 'cancelado') throw new Error('Este pedido está cancelado. Pásalo a Pendiente antes de registrar un pago.');
    const now   = new Date().toISOString();
    const added = (entries || [])
      .map(e => ({
        id:     _newPaymentId(),
        amount: _money(e.amount),
        method: _PAY_METHODS.includes(e.method) ? e.method : null,
        date:   now,
        note:   _str(e.note, 120)
      }))
      .filter(p => p.amount > 0);
    const balance = orderBalance(order);
    const adding  = roundMoney(added.reduce((s, p) => s + p.amount, 0));
    if (adding > balance + 0.005) throw new Error(`Es más de lo que falta pagar (S/ ${balance.toFixed(2)}).`);
    if (!added.length && balance > 0) throw new Error('Escribe cuánto pagó.');

    const payments = [...order.payments, ...added];   // solo pagos reales, nunca el de pedidos antiguos
    let status = statusForPaid(roundMoney(orderPaidAmount(order) + adding), order.total);
    if (status === 'pendiente') status = 'pagado';                                // total S/ 0 (cortesía)
    if (['enviado', 'entregado'].includes(order.status)) status = order.status;   // estados viejos
    if (status === order.status && !added.length) return null;

    const change = { status, payments, paymentMethod: _mainMethod(payments) };
    // Sin la columna de pagos solo se puede marcar "pagado" de una vez, con un método
    if (!order.payments.length && added.length <= 1 && status === 'pagado') {
      change.fallback = { status, paymentMethod: added[0]?.method ?? null };
    }
    return change;
  },

  // Registrar uno o más pagos a la vez (ej. Yape S/ 50 + efectivo S/ 30)
  addPayments(id, entries) {
    return this._commit(id, order => this._planPayments(order, entries));
  },

  // Quitar un pago anotado por error. Si no queda ninguno, el pedido vuelve a
  // pendiente y el stock regresa.
  removePayment(id, paymentId) {
    return this._commit(id, order => {
      const payments = order.payments.filter(p => p.id !== paymentId);
      if (payments.length === order.payments.length) throw new Error('Ese pago ya no existe. Recarga la lista.');
      let status = order.status;
      if (status !== 'cancelado') {
        status = statusForPaid(roundMoney(payments.reduce((s, p) => s + p.amount, 0)), order.total);
        if (['enviado', 'entregado'].includes(order.status) && payments.length) status = order.status;
      }
      return { status, payments, paymentMethod: _mainMethod(payments) };
    });
  },

  // Corregir el método de un pago (ej. se anotó Yape y fue efectivo)
  setPaymentMethod(id, paymentId, method) {
    const m = _PAY_METHODS.includes(method) ? method : null;
    return this._commit(id, order => {
      if (paymentId === 'legacy') return order.paymentMethod === m ? null : { status: order.status, paymentMethod: m };
      if (!order.payments.some(p => p.id === paymentId)) throw new Error('Ese pago ya no existe. Recarga la lista.');
      const payments = order.payments.map(p => p.id === paymentId ? { ...p, method: m } : p);
      return { status: order.status, payments, paymentMethod: _mainMethod(payments) };
    });
  },

  // Cambiar el estado a mano:
  //   · pendiente → borra los pagos anotados (fue un error) y devuelve el stock
  //   · cancelado → devuelve el stock; los pagos quedan anotados pero ya no cuentan
  //   · pagado    → lo que falta se anota como un pago con `paymentMethod`
  // Para "separado" se usa addPayments con el monto del adelanto.
  updateStatus(id, status, paymentMethod = null) {
    return this._commit(id, order => {
      if (status === 'separado') throw new Error('Para separar un pedido, registra el adelanto.');
      if (status === 'pagado') return this._planPayments(order, [{ amount: orderBalance(order), method: paymentMethod }]);
      if (order.status === status) return null;
      const change = { status };
      if (status === 'pendiente' && order.payments.length) {
        change.payments = [];
        change.fallback = { status };
      }
      return change;
    });
  },

  // Si cambió el total de un pedido con pagos, su estado se ajusta (ej. subió el total
  // de uno pagado → queda separado con saldo). El stock no se mueve: separado y
  // pagado lo descuentan igual.
  _syncStatusWithPayments(id) {
    return this._commit(id, order => {
      if (!['separado', 'pagado'].includes(order.status) || !order.payments.length) return null;
      const status = statusForPaid(orderPaidAmount(order), order.total);
      return status === order.status || status === 'pendiente' ? null : { status };
    });
  },

  // Editar un pedido. Si ya está pagado y cambian los productos/cantidades, el
  // stock se ajusta por la diferencia (antes no se tocaba y quedaba desfasado).
  async update(id, data) {
    const result = { stock: [], skipped: [] };
    const newItems = data.items ? _cleanOrderItems(data.items) : null;

    if (newItems) {
      let oldRow = null;
      if (db) {
        const { data: row, error } = await db.from('pedidos').select('status, items').eq('id', id).maybeSingle();
        if (error) throw new Error('No se pudo leer el pedido: ' + (error.message || error.code));
        oldRow = row;
      } else {
        const local = Orders.getById(id);
        oldRow = local ? { status: local.status, items: local.items } : null;
      }
      if (oldRow && isPaidStatus(oldRow.status)) {
        const r = await this._applyStockDelta(newItems, _cleanOrderItems(oldRow.items));
        result.stock = r.summary; result.skipped = r.skipped;
      }
    }

    if (db) {
      const patch = { updated_at: new Date().toISOString() };
      const map = {
        items: 'items', total: 'total', status: 'status',
        customerName: 'customer_name', customerPhone: 'customer_phone',
        customerDni: 'customer_dni', deliveryType: 'delivery_type',
        notes: 'notes', paymentMethod: 'payment_method'
      };
      Object.entries(data).forEach(([k, v]) => { if (map[k]) patch[map[k]] = k === 'items' ? newItems : v; });
      const run = payload => db.from('pedidos').update(payload).eq('id', id).select('id');
      let { data: rows, error } = await run(patch);
      // Fallback: si falla por columna payment_method inexistente, reintentar sin ella
      if (error && 'payment_method' in patch && (error.code === '42703' || error.code === 'PGRST204' || (error.message || '').includes('payment_method'))) {
        const { payment_method, ...fallbackPatch } = patch;
        ({ data: rows, error } = await run(fallbackPatch));
      }
      if (error) throw new Error('No se pudo guardar el pedido: ' + (error.message || error.code));
      // 0 filas: o el pedido solo existe en este navegador (aún sin subir → se sube después
      // con estos cambios) o RLS lo bloqueó porque la sesión de admin venció.
      if ((!rows || !rows.length) && !Orders.getById(id)?._pendingSync) {
        throw new Error('No se pudo guardar el pedido (no existe o tu sesión de admin venció).');
      }
    }

    // Caché local
    const local = Orders.getAll();
    const idx   = local.findIndex(o => o.id === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...data, ...(newItems ? { items: newItems } : {}) };
      Orders.save(local);
    }

    // Cambió el total de un pedido con pagos → su estado se ajusta a lo pagado
    if ('total' in data) {
      try { await this._syncStatusWithPayments(id); }
      catch (err) { console.warn('[MICHT] No se pudo ajustar el estado del pedido al nuevo total:', err); }
    }
    return result;
  },

  async delete(id) {
    if (db) {
      const { error } = await db.from('pedidos').delete().eq('id', id);
      if (error) throw new Error('No se pudo eliminar el pedido: ' + (error.message || error.code));
    }
    Orders.delete(id);
  },

  async getStats() {
    const all = await this.getAll();
    return {
      total:     all.length,
      pendiente: all.filter(o => o.status === 'pendiente').length,
      separado:  all.filter(o => o.status === 'separado').length,
      pagado:    all.filter(o => o.status === 'pagado').length,
      cancelado: all.filter(o => o.status === 'cancelado').length,
      revenue:   roundMoney(incomePayments(all).reduce((s, p) => s + p.amount, 0))
    };
  },

  // ─── Fallback a localStorage ────────────────────────────────────────────────
  _localGetAll()    { return Orders.getAll(); },
  _localGetById(id) { return Orders.getById(id); },
  _localCreate(o)   {
    // Guardar preservando el ID ya generado (no regenerar con Orders.create)
    const orders = Orders.getAll();
    if (orders.some(e => e.id === o.id)) return; // ya existe, no duplicar
    orders.unshift(o);
    Orders.save(orders);
  }
};
