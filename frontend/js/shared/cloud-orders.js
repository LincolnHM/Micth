// ─── Convertir formato Supabase ↔ JavaScript ──────────────────────────────────

function orderFromDB(row) {
  return {
    id:            row.id,
    customerName:  row.customer_name  || '',
    customerPhone: row.customer_phone || '',
    customerDni:   row.customer_dni   || '',
    deliveryType:  row.delivery_type  || 'recojo',
    department:    row.department     || '',
    province:      row.province       || '',
    shalomOffice:  row.shalom_office  || '',
    notes:         row.notes          || '',
    items:         row.items          || [],
    total:         parseFloat(row.total) || 0,
    status:        row.status         || 'pendiente',
    paymentMethod: row.payment_method || null,
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

function generateOrderId() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const time = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 100)).padStart(2,'0');
  return `ORD-${date}-${time}${rand}`;
}

// ─── API de pedidos (async, usa Supabase si está configurado) ─────────────────

const CloudOrders = {

  _lastFetchFromSupabase: false,
  _lastFetchError: null,
  _lastFetchCount: 0,

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
      // Construir mapa de status local para sincronización rápida
      const localStatusMap = {};
      localOrders.forEach(o => { localStatusMap[o.id] = o.status; });
      // Aplicar status de localStorage sobre Supabase si difieren
      // (cubre el caso donde el update a Supabase fue lento o falló)
      const mergedSupabase = supabaseOrders.map(so => {
        const localStatus = localStatusMap[so.id];
        if (localStatus && localStatus !== so.status) return { ...so, status: localStatus };
        return so;
      });
      // Incluir pedidos en localStorage que aún no llegaron a Supabase.
      // Los marcados con _pendingSync (insert falló) se mantienen indefinidamente.
      const supabaseIds  = new Set(mergedSupabase.map(o => o.id));
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
      if (zombies.length) Orders.save(localOrders.filter(o => !zombies.some(z => z.id === o.id)));
      this._lastFetchFromSupabase = true;
      this._lastFetchError = null;
      this._lastFetchCount = supabaseOrders.length;
      if (!pendingLocal.length) return mergedSupabase;
      return [...mergedSupabase, ...pendingLocal]
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
        .single();
      if (error || !data) return this._localGetById(id);
      return orderFromDB(data);
    }
    return this._localGetById(id);
  },

  async create(order) {
    const newOrder = {
      ...order,
      id:     generateOrderId(),
      date:   new Date().toISOString(),
      status: order.status || 'pendiente'
    };
    // Guardar en localStorage primero — garantiza que no se pierde el pedido
    try { this._localCreate(newOrder); } catch {}

    if (db) {
      // Ruta preferida: Edge Function create-order — revalida los precios
      // contra el catálogo real y aplica límite de frecuencia por IP antes
      // de guardar (ver auditoría de seguridad, hallazgo H-02). Si la función
      // todavía no está desplegada o no responde, cae al insert directo de
      // siempre como respaldo — el pedido nunca se pierde.
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey':        SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ ...order, id: newOrder.id })
        });

        if (res.ok) {
          const serverOrder = await res.json().catch(() => null);
          this._markSynced(newOrder.id, serverOrder?.total);
          return newOrder.id;
        }

        // La función respondió pero rechazó el pedido (datos inválidos o
        // demasiados intentos seguidos) — no seguir al insert directo, que
        // se saltaría exactamente esa validación.
        if (res.status === 400 || res.status === 429) {
          const errBody = await res.json().catch(() => ({}));
          this._markPending(newOrder.id);
          const _toast = typeof showToast === 'function' ? showToast
            : typeof showCartToast === 'function' ? showCartToast : null;
          if (_toast) _toast('⚠ ' + (errBody.error || 'No se pudo registrar el pedido.'));
          return newOrder.id;
        }

        throw new Error(`create-order respondió ${res.status}`);
      } catch (fnErr) {
        console.warn('[MICHT] Edge Function create-order no disponible, uso insert directo:', fnErr.message);
      }

      // ── Respaldo: insert directo (comportamiento previo a la Edge Function) ──
      const dbData = orderToDB(newOrder);
      let { error } = await db.from('pedidos').insert(dbData);

      // Fallback: si falla por columna inexistente (ej: payment_method no agregada aún),
      // reintentar sin ese campo para no perder el pedido
      if (error && (error.code === '42703' || (error.message || '').includes('payment_method'))) {
        const { payment_method, ...fallback } = dbData;
        const retry = await db.from('pedidos').insert(fallback);
        error = retry.error;
      }

      if (error) {
        console.error('[MICHT] Error Supabase al guardar pedido:', error.code, error.message);
        this._markPending(newOrder.id);
        const _toast = typeof showToast === 'function' ? showToast
          : typeof showCartToast === 'function' ? showCartToast : null;
        if (_toast) _toast('⚠ Pedido guardado localmente. Error al sincronizar: ' + (error.message || error.code));
      }
    }
    return newOrder.id;
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
        Orders.save(stored);
      }
    } catch {}
  },

  async updateStatus(id, status, paymentMethod = null) {
    // Descontar stock cuando se confirma el pago
    if (status === 'pagado') {
      const order = await this.getById(id);
      if (order && order.status !== 'pagado') {
        // Obtener TODOS los productos de una vez (un solo query) en lugar de
        // hacer N queries individuales con getById dentro del loop
        const allProducts = await CloudProducts.getAll();
        const prodLookup  = {};
        allProducts.forEach(p => { prodLookup[p.id] = p; });

        // Un item de combo no es un producto real — trae su propio desglose
        // (comboItems) con los perfumes que sí hay que descontar del frasco.
        const flatItems = (order.items || []).flatMap(item =>
          Array.isArray(item.comboItems) && item.comboItems.length
            ? item.comboItems.map(ci => ({ ...ci, quantity: (ci.qty || 1) * (item.quantity || 1) }))
            : [item]
        );

        for (const item of flatItems) {
          const pid     = parseInt(item.productId);
          const product = prodLookup[pid];
          if (!product) continue;

          if (product.type === 'entero') {
            const qty    = parseInt(item.quantity || 1);
            const newQty = Math.max(0, (product.stockQuantity || 0) - qty);
            await CloudProducts.update(pid, { stockQuantity: newQty, inStock: newQty > 0 });
            continue;
          }

          // Entero vendido a partir de un decant (frasco sellado aparte, no el
          // que se usa para sacar decants) — descuenta solo el stock de
          // enteros, sin tocar el ml del frasco de decant ni el inStock general.
          if ((product.enteroStock || 0) > 0 && item.size === 'Unidad') {
            const qty      = parseInt(item.quantity || 1);
            const newStock = Math.max(0, (product.enteroStock || 0) - qty);
            await CloudProducts.update(pid, {
              enteroStock:       newStock,
              availableAsEntero: newStock > 0
            });
            continue;
          }

          const mlUsed = parseInt(item.size) * (item.quantity || 1);
          if (isNaN(mlUsed) || mlUsed <= 0) continue;
          const newRemain  = Math.max(0, (product.bottleRemainingMl || 0) - mlUsed);
          const mlUpdate   = { bottleRemainingMl: newRemain };
          // Agotado si lo que queda ya no alcanza ni para el tamaño más chico
          if (newRemain < minDecantSizeMl(product.sizes)) mlUpdate.inStock = false;
          await CloudProducts.update(pid, mlUpdate);
        }
      }
    }
    // Actualizar localStorage siempre (fuente de verdad local)
    Orders.updateStatus(id, status, paymentMethod);
    if (db) {
      const patch = { status, updated_at: new Date().toISOString() };
      if (paymentMethod) patch.payment_method = paymentMethod;
      let { error } = await db.from('pedidos').update(patch).eq('id', id);
      // Fallback: si falla por columna payment_method inexistente, reintentar sin ella
      if (error && paymentMethod && (error.code === '42703' || (error.message || '').includes('payment_method'))) {
        const { payment_method, ...fallbackPatch } = patch;
        const retry = await db.from('pedidos').update(fallbackPatch).eq('id', id);
        error = retry.error;
      }
      if (error) console.error('Supabase error al cambiar estado:', error?.code);
    }
  },

  async update(id, data) {
    // Actualizar localStorage
    const local = Orders.getAll();
    const idx   = local.findIndex(o => o.id === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...data };
      Orders.save(local);
    }
    // Actualizar Supabase
    if (db) {
      const patch = { updated_at: new Date().toISOString() };
      const map = {
        items: 'items', total: 'total', status: 'status',
        customerName: 'customer_name', customerPhone: 'customer_phone',
        customerDni: 'customer_dni', deliveryType: 'delivery_type',
        notes: 'notes', paymentMethod: 'payment_method'
      };
      Object.entries(data).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      let { error } = await db.from('pedidos').update(patch).eq('id', id);
      // Fallback: si falla por columna payment_method inexistente, reintentar sin ella
      if (error && 'payment_method' in patch && (error.code === '42703' || (error.message || '').includes('payment_method'))) {
        const { payment_method, ...fallbackPatch } = patch;
        const retry = await db.from('pedidos').update(fallbackPatch).eq('id', id);
        error = retry.error;
      }
      if (error) { console.error('Supabase error al actualizar pedido:', error?.code); return error; }
    }
    return null;
  },

  async delete(id) {
    Orders.delete(id); // Eliminar de localStorage siempre, antes de Supabase
    if (db) {
      const { error } = await db.from('pedidos').delete().eq('id', id);
      if (error) console.error('Supabase error al eliminar pedido:', error?.code);
    }
  },

  async getStats() {
    const all = await this.getAll();
    return {
      total:     all.length,
      pendiente: all.filter(o => o.status === 'pendiente').length,
      pagado:    all.filter(o => o.status === 'pagado').length,
      cancelado: all.filter(o => o.status === 'cancelado').length,
      revenue:   all.filter(o => o.status === 'pagado')
                    .reduce((s, o) => s + o.total, 0)
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
